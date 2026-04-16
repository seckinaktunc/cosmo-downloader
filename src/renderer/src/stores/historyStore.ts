import { create } from 'zustand'
import type { DownloadHistoryEntry } from '../../../shared/types'

type HistoryState = {
  entries: DownloadHistoryEntry[]
  isSubscribed: boolean
  error?: string
  load: () => Promise<void>
  subscribe: () => void
  remove: (entryId: string) => Promise<void>
  removeMany: (entryIds: string[]) => Promise<void>
  clear: () => Promise<void>
  requeue: (entryId: string) => Promise<void>
  openOutput: (entryId: string) => Promise<void>
  copySource: (entryId: string) => Promise<void>
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  entries: [],
  isSubscribed: false,

  load: async () => {
    const result = await window.cosmo.history.get()
    if (result.ok) {
      set({ entries: result.data, error: undefined })
    } else {
      set({ error: result.error.message })
    }
  },

  subscribe: () => {
    if (get().isSubscribed) {
      return
    }

    window.cosmo.history.onChanged((entries) => set({ entries, error: undefined }))
    set({ isSubscribed: true })
  },

  remove: async (entryId) => {
    const result = await window.cosmo.history.remove({ entryId })
    if (result.ok) set({ entries: result.data, error: undefined })
    else set({ error: result.error.message })
  },

  removeMany: async (entryIds) => {
    const result = await window.cosmo.history.removeMany({ entryIds })
    if (result.ok) set({ entries: result.data, error: undefined })
    else set({ error: result.error.message })
  },

  clear: async () => {
    const result = await window.cosmo.history.clear()
    if (result.ok) set({ entries: result.data, error: undefined })
    else set({ error: result.error.message })
  },

  requeue: async (entryId) => {
    const result = await window.cosmo.history.requeue({ entryId })
    if (!result.ok) {
      set({ error: result.error.message })
    }
  },

  openOutput: async (entryId) => {
    const result = await window.cosmo.history.openOutput({ entryId })
    if (!result.ok) {
      set({ error: result.error.message })
    }
  },

  copySource: async (entryId) => {
    const result = await window.cosmo.history.copySource({ entryId })
    if (!result.ok) {
      set({ error: result.error.message })
    }
  }
}))
