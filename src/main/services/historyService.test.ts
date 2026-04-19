import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { shell } from 'electron'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppSettings, ExportSettings, QueueItem, VideoMetadata } from '../../shared/types'
import { HistoryService } from './historyService'

vi.mock('electron', () => ({
  app: {
    getPath: () => ''
  },
  clipboard: {
    writeText: vi.fn()
  },
  shell: {
    showItemInFolder: vi.fn(),
    openPath: vi.fn().mockResolvedValue('')
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

const exportSettings: ExportSettings = {
  outputFormat: 'mp4',
  resolution: 'auto',
  videoBitrate: 'auto',
  audioBitrate: 'auto',
  frameRate: 'auto',
  videoCodec: 'auto',
  audioCodec: 'auto'
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

function queueItem(id: string): QueueItem {
  return {
    id,
    metadata: metadata(id),
    exportSettings,
    settings,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

function createHistoryService(): HistoryService {
  const directory = mkdtempSync(join(tmpdir(), 'cosmo-history-'))
  tempDirs.push(directory)
  return new HistoryService(join(directory, 'history.json'))
}

afterEach(() => {
  vi.clearAllMocks()
  while (tempDirs.length > 0) {
    const directory = tempDirs.pop()
    if (directory) {
      rmSync(directory, { recursive: true, force: true })
    }
  }
})

describe('HistoryService', () => {
  it('merges missing video bitrate into persisted history entries', () => {
    const directory = mkdtempSync(join(tmpdir(), 'cosmo-history-'))
    tempDirs.push(directory)
    const filePath = join(directory, 'history.json')
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
          status: 'completed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]),
      'utf8'
    )

    const service = new HistoryService(filePath)

    expect(service.get()[0].exportSettings.videoBitrate).toBe('auto')
  })

  it('removes many selected entries in one update', () => {
    const service = createHistoryService()
    const one = service.addStarted(queueItem('one'))
    const two = service.addStarted(queueItem('two'))
    const three = service.addStarted(queueItem('three'))

    const remainingEntries = service.removeMany([one.id, three.id])

    expect(remainingEntries.map((entry) => entry.id)).toEqual([two.id])
    expect(service.get().map((entry) => entry.id)).toEqual([two.id])
  })

  it('ignores missing ids when removing many entries', () => {
    const service = createHistoryService()
    const one = service.addStarted(queueItem('one'))

    expect(service.removeMany(['missing']).map((entry) => entry.id)).toEqual([one.id])
  })

  it('opens downloaded media with the OS default app', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'cosmo-history-'))
    tempDirs.push(directory)
    const outputPath = join(directory, 'video.mp4')
    writeFileSync(outputPath, 'media')
    const service = new HistoryService(join(directory, 'history.json'))
    const entry = service.addStarted(queueItem('one'))
    service.update(entry.id, 'completed', { outputPath })

    await expect(service.openMedia(entry.id)).resolves.toBe(true)
    expect(vi.mocked(shell.openPath)).toHaveBeenCalledWith(outputPath)
  })

  it('reveals the downloaded media folder', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'cosmo-history-'))
    tempDirs.push(directory)
    const outputPath = join(directory, 'video.mp4')
    writeFileSync(outputPath, 'media')
    const service = new HistoryService(join(directory, 'history.json'))
    const entry = service.addStarted(queueItem('one'))
    service.update(entry.id, 'completed', { outputPath })

    await expect(service.openFolder(entry.id)).resolves.toBe(true)
    expect(vi.mocked(shell.showItemInFolder)).toHaveBeenCalledWith(outputPath)
  })
})
