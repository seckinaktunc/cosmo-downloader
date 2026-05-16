import { create } from 'zustand';
import type {
  AppSettings,
  DownloadProgress,
  ExportSettings,
  QueueItem,
  QueueProgressEvent,
  QueueSnapshot,
  VideoMetadata
} from '../../../shared/types';
import { createExportSettingsSaveBuffer } from '../lib/exportSettingsSaveBuffer';
import { useUiStore } from './uiStore';

type QueueState = {
  items: QueueItem[];
  activeItemId?: string;
  paused: boolean;
  progressById: Record<string, DownloadProgress | undefined>;
  isSubscribed: boolean;
  error?: string;
  load: () => Promise<void>;
  subscribe: () => void;
  add: (
    metadata: VideoMetadata,
    exportSettings: ExportSettings,
    settings: AppSettings
  ) => Promise<QueueItem | null>;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  cancelActive: () => Promise<void>;
  skipActive: () => Promise<void>;
  remove: (itemId: string) => Promise<void>;
  removeMany: (itemIds: string[]) => Promise<void>;
  retry: (itemId: string) => Promise<void>;
  reorder: (itemId: string, direction: 'up' | 'down') => Promise<void>;
  move: (itemId: string, targetIndex: number) => Promise<void>;
  moveMany: (itemIds: string[], targetIndex: number) => Promise<void>;
  updateExportSettings: (itemId: string, exportSettings: ExportSettings) => Promise<void>;
  updateExportSettingsDebounced: (itemId: string, exportSettings: ExportSettings) => void;
  flushExportSettingsSaves: () => Promise<void>;
  clear: () => Promise<void>;
};

function applySnapshot(
  set: (state: Partial<QueueState> | ((state: QueueState) => Partial<QueueState>)) => void,
  snapshot: QueueSnapshot
): void {
  set((state) => {
    const activeProgressIds = new Set(
      snapshot.items.filter((item) => item.status === 'active').map((item) => item.id)
    );
    const progressById = Object.fromEntries(
      Object.entries(state.progressById).filter(
        ([itemId, progress]) => progress != null && activeProgressIds.has(itemId)
      )
    );

    return {
      items: snapshot.items,
      activeItemId: snapshot.activeItemId,
      paused: snapshot.paused,
      progressById,
      error: undefined
    };
  });

  const activeExportTarget = useUiStore.getState().activeExportTarget;
  if (
    activeExportTarget?.type === 'queue' &&
    !snapshot.items.some((item) => item.id === activeExportTarget.itemId)
  ) {
    useUiStore.getState().setActiveExportTarget(null);
  }
}

function applyProgressEvent(
  set: (state: Partial<QueueState> | ((state: QueueState) => Partial<QueueState>)) => void,
  event: QueueProgressEvent
): void {
  set((state) => {
    const progressById = { ...state.progressById };

    if (event.cleared || event.progress == null) {
      delete progressById[event.itemId];
    } else {
      progressById[event.itemId] = event.progress;
    }

    return { progressById };
  });
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
  }));
}

async function saveExportSettings(
  set: (state: Partial<QueueState> | ((state: QueueState) => Partial<QueueState>)) => void,
  itemId: string,
  exportSettings: ExportSettings
): Promise<void> {
  const result = await window.cosmo.queue.updateExportSettings({ itemId, exportSettings });
  if (result.ok) applySnapshot(set, result.data);
  else set({ error: result.error.message });
}

const queueExportSettingsSaveBuffer = createExportSettingsSaveBuffer<QueueState, string>({
  applyOptimistic: optimisticallyApplyExportSettings,
  persist: saveExportSettings
});

export const useQueueStore = create<QueueState>((set, get) => ({
  items: [],
  paused: true,
  progressById: {},
  isSubscribed: false,

  load: async () => {
    const result = await window.cosmo.queue.get();
    if (result.ok) {
      applySnapshot(set, result.data);
    } else {
      set({ error: result.error.message });
    }
  },

  subscribe: () => {
    if (get().isSubscribed) {
      return;
    }

    window.cosmo.queue.onSnapshot((snapshot) => applySnapshot(set, snapshot));
    window.cosmo.queue.onProgress((event) => applyProgressEvent(set, event));
    set({ isSubscribed: true });
  },

  add: async (metadata, exportSettings, settings) => {
    const previousIds = new Set(get().items.map((item) => item.id));
    const result = await window.cosmo.queue.add({ metadata, exportSettings, settings });
    if (result.ok) {
      applySnapshot(set, result.data);
      return (
        result.data.items.find((item) => !previousIds.has(item.id)) ??
        result.data.items[result.data.items.length - 1] ??
        null
      );
    }

    if (result.error.code !== 'CANCELLED') {
      set({ error: result.error.message });
    }
    return null;
  },

  start: async () => {
    const result = await window.cosmo.queue.start();
    if (result.ok) applySnapshot(set, result.data);
    else set({ error: result.error.message });
  },

  pause: async () => {
    const result = await window.cosmo.queue.pause();
    if (result.ok) applySnapshot(set, result.data);
    else set({ error: result.error.message });
  },

  resume: async () => {
    const result = await window.cosmo.queue.resume();
    if (result.ok) applySnapshot(set, result.data);
    else set({ error: result.error.message });
  },

  cancelActive: async () => {
    const result = await window.cosmo.queue.cancelActive();
    if (result.ok) applySnapshot(set, result.data);
    else set({ error: result.error.message });
  },

  skipActive: async () => {
    const result = await window.cosmo.queue.skipActive();
    if (result.ok) applySnapshot(set, result.data);
    else set({ error: result.error.message });
  },

  remove: async (itemId) => {
    const result = await window.cosmo.queue.remove({ itemId });
    if (result.ok) applySnapshot(set, result.data);
    else set({ error: result.error.message });
  },

  removeMany: async (itemIds) => {
    const result = await window.cosmo.queue.removeMany({ itemIds });
    if (result.ok) applySnapshot(set, result.data);
    else set({ error: result.error.message });
  },

  retry: async (itemId) => {
    const result = await window.cosmo.queue.retry({ itemId });
    if (result.ok) applySnapshot(set, result.data);
    else set({ error: result.error.message });
  },

  reorder: async (itemId, direction) => {
    const result = await window.cosmo.queue.reorder({ itemId, direction });
    if (result.ok) applySnapshot(set, result.data);
    else set({ error: result.error.message });
  },

  move: async (itemId, targetIndex) => {
    const result = await window.cosmo.queue.move({ itemId, targetIndex });
    if (result.ok) applySnapshot(set, result.data);
    else set({ error: result.error.message });
  },

  moveMany: async (itemIds, targetIndex) => {
    const result = await window.cosmo.queue.moveMany({ itemIds, targetIndex });
    if (result.ok) applySnapshot(set, result.data);
    else set({ error: result.error.message });
  },

  updateExportSettings: async (itemId, exportSettings) => {
    await queueExportSettingsSaveBuffer.save(set, itemId, exportSettings);
  },

  updateExportSettingsDebounced: (itemId, exportSettings) => {
    queueExportSettingsSaveBuffer.saveDebounced(set, itemId, exportSettings);
  },

  flushExportSettingsSaves: async () => queueExportSettingsSaveBuffer.flush(set),

  clear: async () => {
    const result = await window.cosmo.queue.clear();
    if (result.ok) applySnapshot(set, result.data);
    else set({ error: result.error.message });
  }
}));
