import { create } from 'zustand'
import type {
  AppSettings,
  DownloadProgress,
  DownloadStage,
  ExportSettings,
  VideoMetadata
} from '../../../shared/types'

type DownloadState = {
  stage: DownloadStage
  progress: DownloadProgress | null
  error?: string
  isSubscribed: boolean
  trackedPreviewQueueItemId?: string
  trackedPreviewUrl?: string
  completedPreviewUrl?: string
  subscribe: () => void
  start: (
    metadata: VideoMetadata,
    exportSettings: ExportSettings,
    settings: AppSettings
  ) => Promise<void>
  cancel: () => Promise<void>
  reset: () => void
  resetForNewPreview: () => void
  trackPreviewDownload: (queueItemId: string, sourceUrl: string) => void
  markTrackedPreviewCompleted: (queueItemId: string) => void
  clearPreviewDownloadState: () => void
}

const ACTIVE_STAGES: DownloadStage[] = ['downloading', 'processing']

export const useDownloadStore = create<DownloadState>((set, get) => ({
  stage: 'idle',
  progress: null,
  isSubscribed: false,

  subscribe: () => {
    if (get().isSubscribed) {
      return
    }

    window.cosmo.download.onProgress((progress) => {
      set((state) => ({
        stage: progress.stage,
        progress,
        error: progress.stage === 'failed' ? progress.message : undefined,
        ...(progress.stage === 'completed' &&
        progress.queuedItemId != null &&
        progress.queuedItemId === state.trackedPreviewQueueItemId &&
        state.trackedPreviewUrl
          ? {
              completedPreviewUrl: state.trackedPreviewUrl,
              trackedPreviewQueueItemId: undefined,
              trackedPreviewUrl: undefined
            }
          : {})
      }))
    })
    set({ isSubscribed: true })
  },

  start: async (metadata, exportSettings, settings) => {
    if (ACTIVE_STAGES.includes(get().stage)) {
      await get().cancel()
      return
    }

    set({
      stage: 'downloading',
      progress: { stage: 'downloading', stageLabel: 'Downloading', percentage: 0 },
      error: undefined
    })

    const result = await window.cosmo.download.start({ metadata, exportSettings, settings })
    if (!result.ok) {
      set({
        stage: result.error.code === 'CANCELLED' ? 'cancelled' : 'failed',
        error: result.error.message
      })
      return
    }

    set({ stage: result.data.stage, progress: result.data })
  },

  cancel: async () => {
    await window.cosmo.download.cancel()
    set({ stage: 'cancelled', progress: { stage: 'cancelled', stageLabel: 'Cancelled' } })
  },

  reset: () => set({ stage: 'idle', progress: null, error: undefined }),

  resetForNewPreview: () =>
    set((state) => {
      if (ACTIVE_STAGES.includes(state.stage)) {
        return {
          trackedPreviewQueueItemId: undefined,
          trackedPreviewUrl: undefined,
          completedPreviewUrl: undefined
        }
      }

      return {
        stage: 'idle',
        progress: null,
        error: undefined,
        trackedPreviewQueueItemId: undefined,
        trackedPreviewUrl: undefined,
        completedPreviewUrl: undefined
      }
    }),

  trackPreviewDownload: (queueItemId, sourceUrl) =>
    set({
      trackedPreviewQueueItemId: queueItemId,
      trackedPreviewUrl: sourceUrl,
      completedPreviewUrl: undefined
    }),

  markTrackedPreviewCompleted: (queueItemId) =>
    set((state) => {
      if (state.trackedPreviewQueueItemId !== queueItemId || !state.trackedPreviewUrl) {
        return {}
      }

      return {
        completedPreviewUrl: state.trackedPreviewUrl,
        trackedPreviewQueueItemId: undefined,
        trackedPreviewUrl: undefined
      }
    }),

  clearPreviewDownloadState: () =>
    set({
      trackedPreviewQueueItemId: undefined,
      trackedPreviewUrl: undefined,
      completedPreviewUrl: undefined
    })
}))
