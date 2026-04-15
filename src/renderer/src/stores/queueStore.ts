import { create } from 'zustand'
import type {
  AppSettings,
  ExportSettings,
  QueueItem,
  QueueSnapshot,
  VideoMetadata
} from '../../../shared/types'

type QueueState = {
  items: QueueItem[]
  activeItemId?: string
  paused: boolean
  isSubscribed: boolean
  error?: string
  load: () => Promise<void>
  subscribe: () => void
  add: (
    metadata: VideoMetadata,
    exportSettings: ExportSettings,
    settings: AppSettings
  ) => Promise<boolean>
  start: () => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  cancelActive: () => Promise<void>
  remove: (itemId: string) => Promise<void>
  removeMany: (itemIds: string[]) => Promise<void>
  retry: (itemId: string) => Promise<void>
  reorder: (itemId: string, direction: 'up' | 'down') => Promise<void>
  move: (itemId: string, targetIndex: number) => Promise<void>
  moveMany: (itemIds: string[], targetIndex: number) => Promise<void>
  clear: () => Promise<void>
}

function applySnapshot(set: (state: Partial<QueueState>) => void, snapshot: QueueSnapshot): void {
  set({
    items: snapshot.items,
    activeItemId: snapshot.activeItemId,
    paused: snapshot.paused,
    error: undefined
  })
}

export const useQueueStore = create<QueueState>((set, get) => ({
  items: [],
  paused: true,
  isSubscribed: false,

  load: async () => {
    const result = await window.cosmo.queue.get()
    if (result.ok) {
      applySnapshot(set, result.data)
    } else {
      set({ error: result.error.message })
    }
  },

  subscribe: () => {
    if (get().isSubscribed) {
      return
    }

    window.cosmo.queue.onSnapshot((snapshot) => applySnapshot(set, snapshot))
    set({ isSubscribed: true })
  },

  add: async (metadata, exportSettings, settings) => {
    const result = await window.cosmo.queue.add({ metadata, exportSettings, settings })
    if (result.ok) {
      applySnapshot(set, result.data)
      return true
    }

    if (result.error.code !== 'CANCELLED') {
      set({ error: result.error.message })
    }
    return false
  },

  start: async () => {
    const result = await window.cosmo.queue.start()
    if (result.ok) applySnapshot(set, result.data)
    else set({ error: result.error.message })
  },

  pause: async () => {
    const result = await window.cosmo.queue.pause()
    if (result.ok) applySnapshot(set, result.data)
    else set({ error: result.error.message })
  },

  resume: async () => {
    const result = await window.cosmo.queue.resume()
    if (result.ok) applySnapshot(set, result.data)
    else set({ error: result.error.message })
  },

  cancelActive: async () => {
    const result = await window.cosmo.queue.cancelActive()
    if (result.ok) applySnapshot(set, result.data)
    else set({ error: result.error.message })
  },

  remove: async (itemId) => {
    const result = await window.cosmo.queue.remove({ itemId })
    if (result.ok) applySnapshot(set, result.data)
    else set({ error: result.error.message })
  },

  removeMany: async (itemIds) => {
    const result = await window.cosmo.queue.removeMany({ itemIds })
    if (result.ok) applySnapshot(set, result.data)
    else set({ error: result.error.message })
  },

  retry: async (itemId) => {
    const result = await window.cosmo.queue.retry({ itemId })
    if (result.ok) applySnapshot(set, result.data)
    else set({ error: result.error.message })
  },

  reorder: async (itemId, direction) => {
    const result = await window.cosmo.queue.reorder({ itemId, direction })
    if (result.ok) applySnapshot(set, result.data)
    else set({ error: result.error.message })
  },

  move: async (itemId, targetIndex) => {
    const result = await window.cosmo.queue.move({ itemId, targetIndex })
    if (result.ok) applySnapshot(set, result.data)
    else set({ error: result.error.message })
  },

  moveMany: async (itemIds, targetIndex) => {
    const result = await window.cosmo.queue.moveMany({ itemIds, targetIndex })
    if (result.ok) applySnapshot(set, result.data)
    else set({ error: result.error.message })
  },

  clear: async () => {
    const result = await window.cosmo.queue.clear()
    if (result.ok) applySnapshot(set, result.data)
    else set({ error: result.error.message })
  }
}))
