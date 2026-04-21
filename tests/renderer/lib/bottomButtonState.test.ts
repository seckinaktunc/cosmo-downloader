import { describe, expect, it } from 'vitest'
import type { QueueItem } from '@shared/types'
import { DEFAULT_EXPORT_SETTINGS } from '@shared/defaults'
import { getBottomButtonState } from '@renderer/lib/bottomButtonState'

const queueItem: QueueItem = {
  id: 'item-1',
  metadata: {
    requestId: 'request',
    url: 'https://example.com/video',
    title: 'Video',
    containers: [],
    videoCodecs: [],
    audioCodecs: [],
    fpsOptions: [],
    formats: []
  },
  exportSettings: DEFAULT_EXPORT_SETTINGS,
  settings: {
    hardwareAcceleration: true,
    automaticUpdates: true,
    alwaysAskDownloadLocation: false,
    createFolderPerDownload: false,
    defaultDownloadLocation: '/downloads',
    interfaceLanguage: 'en_US',
    cookiesBrowser: 'none',
    alwaysOnTop: false
  },
  status: 'pending',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}

describe('getBottomButtonState', () => {
  it('shows cancel progress for active queue work', () => {
    expect(
      getBottomButtonState({
        activeItem: {
          ...queueItem,
          status: 'active',
          progress: {
            stage: 'downloading',
            stageLabel: 'Downloading',
            percentage: 42,
            downloadedBytes: 1024,
            totalBytes: 2048
          }
        },
        queueItems: [{ ...queueItem, status: 'active' }],
        downloadStage: 'idle',
        progress: null,
        videoStage: 'ready',
        canDownloadPreview: true,
        currentPreviewCompleted: false,
        hasPendingQueueItems: false
      }).primary
    ).toBe('Queue 1 of 1 (42%)')
  })

  it('shows start queue when pending queue items exist', () => {
    expect(
      getBottomButtonState({
        queueItems: [queueItem],
        downloadStage: 'idle',
        progress: null,
        videoStage: 'idle',
        canDownloadPreview: false,
        currentPreviewCompleted: false,
        hasPendingQueueItems: true
      })
    ).toMatchObject({ mode: 'start', primary: 'Start Queue (1)' })
  })

  it('uses the supplied queue start count in the queue button label', () => {
    expect(
      getBottomButtonState({
        queueItems: [queueItem],
        downloadStage: 'idle',
        progress: null,
        videoStage: 'ready',
        canDownloadPreview: true,
        currentPreviewCompleted: false,
        hasPendingQueueItems: true,
        queueStartCount: 5
      })
    ).toMatchObject({ mode: 'start', primary: 'Start Queue (5)' })
  })

  it('lets pending queue items take priority over a completed preview', () => {
    expect(
      getBottomButtonState({
        queueItems: [queueItem],
        downloadStage: 'completed',
        progress: null,
        videoStage: 'ready',
        canDownloadPreview: true,
        currentPreviewCompleted: true,
        hasPendingQueueItems: true
      })
    ).toMatchObject({ mode: 'start', primary: 'Start Queue (1)' })
  })

  it('shows new video only for the current completed preview without pending work', () => {
    expect(
      getBottomButtonState({
        queueItems: [],
        downloadStage: 'completed',
        progress: null,
        videoStage: 'ready',
        canDownloadPreview: true,
        currentPreviewCompleted: true,
        hasPendingQueueItems: false
      })
    ).toMatchObject({ mode: 'new_video', primary: 'New Video' })
  })
})
