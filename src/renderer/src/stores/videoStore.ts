import { create } from 'zustand'
import type { AppSettings, DownloadStage, VideoMetadata } from '../../../shared/types'
import { validateUrl } from '../lib/validateUrl'
import { classifyVideoUrl } from '../lib/videoUrlClassifier'

type VideoState = {
  url: string
  metadata: VideoMetadata | null
  stage: DownloadStage
  error?: string
  activeRequestId?: string
  setUrl: (url: string) => void
  clear: () => void
  fetchMetadata: (settings: AppSettings) => Promise<void>
}

export const useVideoStore = create<VideoState>((set, get) => ({
  url: '',
  metadata: null,
  stage: 'idle',

  setUrl: (url) => set({ url, error: undefined }),

  clear: () => {
    const requestId = get().activeRequestId
    if (requestId) {
      void window.cosmo.video.cancelMetadata({ requestId })
    }

    set({ url: '', metadata: null, stage: 'idle', error: undefined, activeRequestId: undefined })
  },

  fetchMetadata: async (settings) => {
    const url = get().url.trim()
    const validation = validateUrl(url)
    if (!validation.isValid || !validation.normalized) {
      set({ metadata: null, stage: 'idle', error: validation.reason })
      return
    }

    const kind = classifyVideoUrl(validation.normalized)
    if (kind === 'playlist' || kind === 'channel') {
      set({
        metadata: null,
        stage: 'failed',
        error: 'Only single-video links are supported in this version.'
      })
      return
    }

    const previousRequestId = get().activeRequestId
    if (previousRequestId) {
      void window.cosmo.video.cancelMetadata({ requestId: previousRequestId })
    }

    const requestId = crypto.randomUUID()
    set({ activeRequestId: requestId, stage: 'fetching_metadata', error: undefined })

    const result = await window.cosmo.video.fetchMetadata({
      requestId,
      url: validation.normalized,
      settings
    })

    if (get().activeRequestId !== requestId) {
      return
    }

    if (result.ok) {
      set({ metadata: result.data, stage: 'ready', error: undefined, activeRequestId: undefined })
      return
    }

    if (result.error.code === 'CANCELLED') {
      return
    }

    set({
      metadata: null,
      stage: 'failed',
      error: result.error.message,
      activeRequestId: undefined
    })
  }
}))
