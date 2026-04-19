import { create } from 'zustand'
import type { UpdateState } from '../../../shared/types'

type UpdateStoreState = {
  state: UpdateState
  isSubscribed: boolean
  dismissedAvailableVersion?: string
  dismissedDownloadedVersion?: string
  load: () => Promise<void>
  subscribe: () => void
  checkNow: () => Promise<void>
  download: () => Promise<void>
  install: () => Promise<void>
  dismissAvailable: () => void
  dismissDownloaded: () => void
}

const initialState: UpdateState = { status: 'idle' }

function versionKey(state: UpdateState): string | undefined {
  return state.updateInfo?.version
}

export const useUpdateStore = create<UpdateStoreState>((set, get) => ({
  state: initialState,
  isSubscribed: false,

  load: async () => {
    const result = await window.cosmo.updates.getState()
    if (result.ok) {
      set({ state: result.data })
    } else {
      set({ state: { status: 'error', error: result.error.message } })
    }
  },

  subscribe: () => {
    if (get().isSubscribed) {
      return
    }

    window.cosmo.updates.onState((state) => set({ state }))
    set({ isSubscribed: true })
  },

  checkNow: async () => {
    const result = await window.cosmo.updates.checkNow()
    if (result.ok) {
      set({
        state: result.data,
        dismissedAvailableVersion: undefined,
        dismissedDownloadedVersion: undefined
      })
      return
    }

    set({ state: { ...get().state, status: 'error', error: result.error.message } })
  },

  download: async () => {
    const result = await window.cosmo.updates.download()
    if (result.ok) {
      set({ state: result.data, dismissedAvailableVersion: undefined })
      return
    }

    set({ state: { ...get().state, error: result.error.message } })
  },

  install: async () => {
    const result = await window.cosmo.updates.install()
    if (result.ok) {
      set({ state: result.data })
      return
    }

    set({ state: { ...get().state, error: result.error.message } })
  },

  dismissAvailable: () =>
    set((store) => ({
      dismissedAvailableVersion: versionKey(store.state)
    })),

  dismissDownloaded: () =>
    set((store) => ({
      dismissedDownloadedVersion: versionKey(store.state)
    }))
}))
