import { create } from 'zustand'
import type { DownloadHistoryEntry } from '../../../shared/types'
import { useUiStore } from './uiStore'

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
  openMedia: (entryId: string) => Promise<boolean>
  openFolder: (entryId: string) => Promise<boolean>
  copySource: (entryId: string) => Promise<void>
}

function applyEntries(
  set: (state: Partial<HistoryState>) => void,
  entries: DownloadHistoryEntry[]
): void {
  set({ entries, error: undefined })

  const activeExportTarget = useUiStore.getState().activeExportTarget
  if (
    activeExportTarget?.type === 'history' &&
    !entries.some((entry) => entry.id === activeExportTarget.entryId)
  ) {
    useUiStore.getState().setActiveExportTarget(null)
  }
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  entries: [],
  isSubscribed: false,

  load: async () => {
    const result = await window.cosmo.history.get()
    if (result.ok) {
      applyEntries(set, result.data)
    } else {
      set({ error: result.error.message })
    }
  },

  subscribe: () => {
    if (get().isSubscribed) {
      return
    }

    window.cosmo.history.onChanged((entries) => applyEntries(set, entries))
    set({ isSubscribed: true })
  },

  remove: async (entryId) => {
    const result = await window.cosmo.history.remove({ entryId })
    if (result.ok) applyEntries(set, result.data)
    else set({ error: result.error.message })
  },

  removeMany: async (entryIds) => {
    const result = await window.cosmo.history.removeMany({ entryIds })
    if (result.ok) applyEntries(set, result.data)
    else set({ error: result.error.message })
  },

  clear: async () => {
    const result = await window.cosmo.history.clear()
    if (result.ok) applyEntries(set, result.data)
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

  openMedia: async (entryId) => {
    const result = await window.cosmo.history.openMedia({ entryId })
    if (!result.ok) {
      set({ error: result.error.message })
      return false
    }

    return true
  },

  openFolder: async (entryId) => {
    const result = await window.cosmo.history.openFolder({ entryId })
    if (!result.ok) {
      set({ error: result.error.message })
      return false
    }

    return true
  },

  copySource: async (entryId) => {
    const result = await window.cosmo.history.copySource({ entryId })
    if (!result.ok) {
      set({ error: result.error.message })
    }
  }
}))
