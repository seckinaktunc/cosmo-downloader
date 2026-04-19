import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { WebContents } from 'electron'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_EXPORT_SETTINGS } from '../../shared/defaults'
import type {
  AppSettings,
  DownloadProgress,
  ExportSettings,
  QueueItem,
  VideoMetadata
} from '../../shared/types'
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
  createFolderPerDownload: false,
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

function queueItem(id: string, status: QueueItem['status']): QueueItem {
  return {
    id,
    metadata: metadata(id),
    exportSettings: DEFAULT_EXPORT_SETTINGS,
    settings,
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
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

  it('prunes completed and cancelled persisted queue items', () => {
    const directory = mkdtempSync(join(tmpdir(), 'cosmo-queue-'))
    tempDirs.push(directory)
    const filePath = join(directory, 'queue.json')
    writeFileSync(
      filePath,
      JSON.stringify([
        queueItem('pending', 'pending'),
        queueItem('completed', 'completed'),
        queueItem('cancelled', 'cancelled')
      ]),
      'utf8'
    )

    const service = new QueueService({} as DownloadService, {} as HistoryService, filePath)

    expect(service.getSnapshot().items.map((item) => item.id)).toEqual(['pending'])
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

  it('prunes completed queue items after history is updated', async () => {
    const completedProgress: DownloadProgress = {
      stage: 'completed',
      stageLabel: 'Completed',
      percentage: 100,
      outputPath: '/downloads/video.mp4'
    }
    const downloadService = {
      start: vi.fn().mockResolvedValue({ ok: true, data: completedProgress }),
      cancel: vi.fn()
    } as unknown as DownloadService
    const historyService = {
      addStarted: vi.fn((item: QueueItem) => ({
        id: 'history-entry',
        queueItemId: item.id,
        metadata: item.metadata,
        exportSettings: item.exportSettings,
        settings: item.settings,
        status: 'started',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })),
      update: vi.fn()
    } as unknown as HistoryService
    const directory = mkdtempSync(join(tmpdir(), 'cosmo-queue-'))
    tempDirs.push(directory)
    const service = new QueueService(downloadService, historyService, join(directory, 'queue.json'))
    const addResult = await service.add({
      metadata: metadata('one'),
      exportSettings: DEFAULT_EXPORT_SETTINGS,
      settings
    })
    if (!addResult.ok) throw new Error(addResult.error.message)

    service.start({ isDestroyed: () => false } as WebContents)

    await vi.waitFor(() => {
      expect(service.getSnapshot().items).toEqual([])
    })
    expect(historyService.update).toHaveBeenCalledWith('history-entry', 'completed', {
      outputPath: '/downloads/video.mp4'
    })
  })
})
