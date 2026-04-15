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
  subscribe: () => void
  start: (
    metadata: VideoMetadata,
    exportSettings: ExportSettings,
    settings: AppSettings
  ) => Promise<void>
  cancel: () => Promise<void>
  reset: () => void
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
      set({
        stage: progress.stage,
        progress,
        error: progress.stage === 'failed' ? progress.message : undefined
      })
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

  reset: () => set({ stage: 'idle', progress: null, error: undefined })
}))
