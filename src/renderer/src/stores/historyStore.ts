import { create } from 'zustand';
import type {
  DownloadHistoryEntry,
  HistoryChangedEvent,
  HistoryListResult
} from '../../../shared/types';
import { useUiStore } from './uiStore';

const HISTORY_PAGE_SIZE = 10;

let historyRequestToken = 0;

type LoadVisibleRangeOptions = {
  targetCount: number;
  showInitialLoading?: boolean;
  showLoadMore?: boolean;
};

type HistoryState = {
  entries: DownloadHistoryEntry[];
  totalCount: number;
  loadedCount: number;
  isSubscribed: boolean;
  isLoadingInitial: boolean;
  isLoadingMore: boolean;
  hasOpenedPanel: boolean;
  error?: string;
  load: () => Promise<void>;
  loadMore: () => Promise<void>;
  markOpened: () => void;
  subscribe: () => void;
  remove: (entryId: string) => Promise<void>;
  removeMany: (entryIds: string[]) => Promise<void>;
  clear: () => Promise<void>;
  requeue: (entryId: string) => Promise<void>;
  openOutput: (entryId: string) => Promise<void>;
  openMedia: (entryId: string) => Promise<boolean>;
  openFolder: (entryId: string) => Promise<boolean>;
  copySource: (entryId: string) => Promise<void>;
};

function syncActiveExportTarget(entries: DownloadHistoryEntry[]): void {
  const activeExportTarget = useUiStore.getState().activeExportTarget;
  if (
    activeExportTarget?.type === 'history' &&
    !entries.some((entry) => entry.id === activeExportTarget.entryId)
  ) {
    useUiStore.getState().setActiveExportTarget(null);
  }
}

function applyPage(set: (state: Partial<HistoryState>) => void, page: HistoryListResult): void {
  set({
    entries: page.entries,
    totalCount: page.totalCount,
    loadedCount: page.entries.length,
    error: undefined
  });
  syncActiveExportTarget(page.entries);
}

async function loadVisibleRange(
  set: (state: Partial<HistoryState>) => void,
  options: LoadVisibleRangeOptions
): Promise<HistoryListResult | null> {
  const targetCount = Math.max(0, Math.trunc(options.targetCount));
  const requestToken = ++historyRequestToken;

  if (options.showInitialLoading) {
    set({ isLoadingInitial: true });
  }
  if (options.showLoadMore) {
    set({ isLoadingMore: true });
  }

  try {
    const result = await window.cosmo.history.get({ offset: 0, limit: targetCount });
    if (requestToken !== historyRequestToken) {
      return null;
    }

    if (!result.ok) {
      set({ error: result.error.message });
      return null;
    }

    applyPage(set, result.data);
    return result.data;
  } finally {
    if (requestToken === historyRequestToken) {
      set({ isLoadingInitial: false, isLoadingMore: false });
    }
  }
}

function nextLoadedCountAfterChange(
  currentState: Pick<HistoryState, 'hasOpenedPanel' | 'loadedCount' | 'totalCount'>,
  event: HistoryChangedEvent
): number {
  if (!currentState.hasOpenedPanel) {
    return Math.min(HISTORY_PAGE_SIZE, event.totalCount);
  }

  if (event.totalCount > currentState.totalCount) {
    const positiveDelta = event.totalCount - currentState.totalCount;
    return currentState.loadedCount + positiveDelta;
  }

  return Math.min(currentState.loadedCount, event.totalCount);
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  entries: [],
  totalCount: 0,
  loadedCount: 0,
  isSubscribed: false,
  isLoadingInitial: false,
  isLoadingMore: false,
  hasOpenedPanel: false,

  load: async () => {
    await loadVisibleRange(set, {
      targetCount: HISTORY_PAGE_SIZE,
      showInitialLoading: true
    });
  },

  loadMore: async () => {
    const state = get();
    if (state.isLoadingInitial || state.isLoadingMore || state.loadedCount >= state.totalCount) {
      return;
    }

    await loadVisibleRange(set, {
      targetCount: Math.min(state.totalCount, state.loadedCount + HISTORY_PAGE_SIZE),
      showLoadMore: true
    });
  },

  markOpened: () => {
    if (!get().hasOpenedPanel) {
      set({ hasOpenedPanel: true });
    }
  },

  subscribe: () => {
    if (get().isSubscribed) {
      return;
    }

    window.cosmo.history.onChanged((event) => {
      const targetCount = nextLoadedCountAfterChange(get(), event);
      void loadVisibleRange(set, { targetCount });
    });

    set({ isSubscribed: true });
  },

  remove: async (entryId) => {
    const result = await window.cosmo.history.remove({ entryId });
    if (!result.ok) {
      set({ error: result.error.message });
      return;
    }

    await loadVisibleRange(set, { targetCount: get().loadedCount });
  },

  removeMany: async (entryIds) => {
    const result = await window.cosmo.history.removeMany({ entryIds });
    if (!result.ok) {
      set({ error: result.error.message });
      return;
    }

    await loadVisibleRange(set, { targetCount: get().loadedCount });
  },

  clear: async () => {
    const result = await window.cosmo.history.clear();
    if (!result.ok) {
      set({ error: result.error.message });
      return;
    }

    await loadVisibleRange(set, { targetCount: 0 });
  },

  requeue: async (entryId) => {
    const result = await window.cosmo.history.requeue({ entryId });
    if (!result.ok) {
      set({ error: result.error.message });
    }
  },

  openOutput: async (entryId) => {
    const result = await window.cosmo.history.openOutput({ entryId });
    if (!result.ok) {
      set({ error: result.error.message });
    }
  },

  openMedia: async (entryId) => {
    const result = await window.cosmo.history.openMedia({ entryId });
    if (!result.ok) {
      set({ error: result.error.message });
      return false;
    }

    return true;
  },

  openFolder: async (entryId) => {
    const result = await window.cosmo.history.openFolder({ entryId });
    if (!result.ok) {
      set({ error: result.error.message });
      return false;
    }

    return true;
  },

  copySource: async (entryId) => {
    const result = await window.cosmo.history.copySource({ entryId });
    if (!result.ok) {
      set({ error: result.error.message });
    }
  }
}));
