import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_EXPORT_SETTINGS } from '../../shared/defaults'
import type { AppSettings, ExportSettings, VideoMetadata } from '../../shared/types'
import type { DownloadService } from './downloadService'
import type { HistoryService } from './historyService'
import { QueueService } from './queueService'

vi.mock('electron', () => ({
  app: {
    getPath: () => ''
  },
  dialog: {
    showSaveDialog: vi.fn()
  },
  webContents: {
    getAllWebContents: () => []
  }
}))

const tempDirs: string[] = []

const settings: AppSettings = {
  hardwareAcceleration: true,
  automaticUpdates: true,
  alwaysAskDownloadLocation: false,
  defaultDownloadLocation: '/downloads',
  interfaceLanguage: 'en_US',
  cookiesBrowser: 'none',
  alwaysOnTop: false
}

function metadata(title: string): VideoMetadata {
  return {
    requestId: title,
    url: `https://example.com/${title}`,
    title,
    containers: [],
    videoCodecs: [],
    audioCodecs: [],
    fpsOptions: [],
    formats: []
  }
}

function createQueueService(): QueueService {
  const directory = mkdtempSync(join(tmpdir(), 'cosmo-queue-'))
  tempDirs.push(directory)
  return new QueueService(
    {} as DownloadService,
    {} as HistoryService,
    join(directory, 'queue.json')
  )
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const directory = tempDirs.pop()
    if (directory) {
      rmSync(directory, { recursive: true, force: true })
    }
  }
})

describe('QueueService export settings updates', () => {
  it('merges missing video bitrate into persisted queue items', () => {
    const directory = mkdtempSync(join(tmpdir(), 'cosmo-queue-'))
    tempDirs.push(directory)
    const filePath = join(directory, 'queue.json')
    writeFileSync(
      filePath,
      JSON.stringify([
        {
          id: 'legacy',
          metadata: metadata('legacy'),
          exportSettings: {
            outputFormat: 'mp4',
            resolution: 'auto',
            audioBitrate: 'auto',
            frameRate: 'auto',
            videoCodec: 'auto',
            audioCodec: 'auto'
          },
          settings,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]),
      'utf8'
    )

    const service = new QueueService({} as DownloadService, {} as HistoryService, filePath)

    expect(service.getSnapshot().items[0].exportSettings.videoBitrate).toBe('auto')
  })

  it('updates export settings for pending queue items', async () => {
    const service = createQueueService()
    const addResult = await service.add({
      metadata: metadata('one'),
      exportSettings: DEFAULT_EXPORT_SETTINGS,
      settings
    })
    if (!addResult.ok) throw new Error(addResult.error.message)
    const itemId = addResult.data.items[0].id
    const nextSettings: ExportSettings = { ...DEFAULT_EXPORT_SETTINGS, outputFormat: 'mkv' }

    const result = service.updateExportSettings({ itemId, exportSettings: nextSettings })

    expect(result.ok).toBe(true)
    expect(service.getSnapshot().items[0].exportSettings).toEqual(nextSettings)
  })

  it('rejects export settings updates for completed queue items', async () => {
    const service = createQueueService()
    const addResult = await service.add({
      metadata: metadata('one'),
      exportSettings: DEFAULT_EXPORT_SETTINGS,
      settings
    })
    if (!addResult.ok) throw new Error(addResult.error.message)
    const itemId = addResult.data.items[0].id
    service.getSnapshot().items[0].status = 'completed'

    const result = service.updateExportSettings({
      itemId,
      exportSettings: { ...DEFAULT_EXPORT_SETTINGS, outputFormat: 'webm' }
    })

    expect(result.ok).toBe(false)
  })
})
