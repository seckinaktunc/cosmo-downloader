import { create } from 'zustand'
import type {
  AppSettings,
  ExportSettings,
  QueueItem,
  QueueSnapshot,
  VideoMetadata
} from '../../../shared/types'
import { useUiStore } from './uiStore'

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
  ) => Promise<QueueItem | null>
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
  updateExportSettings: (itemId: string, exportSettings: ExportSettings) => Promise<void>
  updateExportSettingsDebounced: (itemId: string, exportSettings: ExportSettings) => void
  flushExportSettingsSaves: () => Promise<void>
  clear: () => Promise<void>
}

type PendingExportSettingsSave = {
  timer: number
  exportSettings: ExportSettings
}

const pendingExportSettingsSaves = new Map<string, PendingExportSettingsSave>()

function applySnapshot(set: (state: Partial<QueueState>) => void, snapshot: QueueSnapshot): void {
  set({
    items: snapshot.items,
    activeItemId: snapshot.activeItemId,
    paused: snapshot.paused,
    error: undefined
  })

  const activeExportTarget = useUiStore.getState().activeExportTarget
  if (
    activeExportTarget?.type === 'queue' &&
    !snapshot.items.some((item) => item.id === activeExportTarget.itemId)
  ) {
    useUiStore.getState().setActiveExportTarget(null)
  }
}

function optimisticallyApplyExportSettings(
  set: (state: Partial<QueueState> | ((state: QueueState) => Partial<QueueState>)) => void,
  itemId: string,
  exportSettings: ExportSettings
): void {
  set((state) => ({
    items: state.items.map((item) =>
      item.id === itemId
        ? { ...item, exportSettings, requestedOutputPath: exportSettings.savePath }
        : item
    )
  }))
}

async function saveExportSettings(
  set: (state: Partial<QueueState>) => void,
  itemId: string,
  exportSettings: ExportSettings
): Promise<void> {
  const result = await window.cosmo.queue.updateExportSettings({ itemId, exportSettings })
  if (result.ok) applySnapshot(set, result.data)
  else set({ error: result.error.message })
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
    const previousIds = new Set(get().items.map((item) => item.id))
    const result = await window.cosmo.queue.add({ metadata, exportSettings, settings })
    if (result.ok) {
      applySnapshot(set, result.data)
      return (
        result.data.items.find((item) => !previousIds.has(item.id)) ??
        result.data.items[result.data.items.length - 1] ??
        null
      )
    }

    if (result.error.code !== 'CANCELLED') {
      set({ error: result.error.message })
    }
    return null
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

  updateExportSettings: async (itemId, exportSettings) => {
    const pending = pendingExportSettingsSaves.get(itemId)
    if (pending) {
      window.clearTimeout(pending.timer)
      pendingExportSettingsSaves.delete(itemId)
    }

    optimisticallyApplyExportSettings(set, itemId, exportSettings)
    await saveExportSettings(set, itemId, exportSettings)
  },

  updateExportSettingsDebounced: (itemId, exportSettings) => {
    const pending = pendingExportSettingsSaves.get(itemId)
    if (pending) {
      window.clearTimeout(pending.timer)
    }

    optimisticallyApplyExportSettings(set, itemId, exportSettings)
    const timer = window.setTimeout(() => {
      pendingExportSettingsSaves.delete(itemId)
      void saveExportSettings(set, itemId, exportSettings)
    }, 300)
    pendingExportSettingsSaves.set(itemId, { timer, exportSettings })
  },

  flushExportSettingsSaves: async () => {
    const saves = Array.from(pendingExportSettingsSaves.entries())
    pendingExportSettingsSaves.clear()
    await Promise.all(
      saves.map(([itemId, pending]) => {
        window.clearTimeout(pending.timer)
        return saveExportSettings(set, itemId, pending.exportSettings)
      })
    )
  },

  clear: async () => {
    const result = await window.cosmo.queue.clear()
    if (result.ok) applySnapshot(set, result.data)
    else set({ error: result.error.message })
  }
}))
