import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_EXPORT_SETTINGS } from '@shared/defaults';
import type {
  AppSettings,
  DownloadHistoryEntry,
  HistoryChangedEvent,
  HistoryListRequest,
  HistoryListResult,
  IpcResult,
  VideoMetadata
} from '@shared/types';
import { useHistoryStore } from '@renderer/stores/historyStore';
import { useUiStore } from '@renderer/stores/uiStore';

const settings: AppSettings = {
  hardwareAcceleration: true,
  automaticUpdates: true,
  alwaysAskDownloadLocation: false,
  createFolderPerDownload: false,
  defaultDownloadLocation: '/downloads',
  lastDownloadDirectory: '/downloads',
  interfaceLanguage: 'en_US',
  cookiesBrowser: 'none',
  alwaysOnTop: false,
  clipboardPrefetchEnabled: true,
  cacheLimitMb: 50,
  historyLimitItems: 500,
  preferencesSectionsExpanded: {
    general: true,
    downloads: true,
    metadata: true,
    updates: true
  }
};

function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data };
}

function metadata(id: string): VideoMetadata {
  return {
    requestId: id,
    url: `https://example.com/${id}`,
    title: id,
    containers: [],
    videoCodecs: [],
    audioCodecs: [],
    fpsOptions: [],
    formats: []
  };
}

function historyEntry(id: string, index: number): DownloadHistoryEntry {
  return {
    id,
    metadata: metadata(id),
    exportSettings: DEFAULT_EXPORT_SETTINGS,
    settings,
    status: 'completed',
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, 30 - index)).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, 30 - index)).toISOString()
  };
}

function createEntries(count: number): DownloadHistoryEntry[] {
  return Array.from({ length: count }, (_value, index) => historyEntry(`item-${index + 1}`, index));
}

function flushAsyncWork(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function installHistoryMock(initialEntries: DownloadHistoryEntry[]): {
  getMock: ReturnType<typeof vi.fn>;
  emitChanged: () => void;
  prependEntries: (...entries: DownloadHistoryEntry[]) => void;
  replaceEntries: (entries: DownloadHistoryEntry[]) => void;
} {
  let entries = [...initialEntries];
  let onChanged: ((event: HistoryChangedEvent) => void) | null = null;

  const getMock = vi.fn(async (request: HistoryListRequest) =>
    ok<HistoryListResult>({
      entries: entries.slice(request.offset, request.offset + request.limit),
      totalCount: entries.length
    })
  );

  const removeMock = vi.fn(async ({ entryId }: { entryId: string }) => {
    entries = entries.filter((entry) => entry.id !== entryId);
    return ok<null>(null);
  });

  vi.stubGlobal('window', {
    cosmo: {
      history: {
        get: getMock,
        remove: removeMock,
        removeMany: vi.fn(async ({ entryIds }: { entryIds: string[] }) => {
          const selectedIds = new Set(entryIds);
          entries = entries.filter((entry) => !selectedIds.has(entry.id));
          return ok<null>(null);
        }),
        clear: vi.fn(async () => {
          entries = [];
          return ok<null>(null);
        }),
        recordFetch: vi.fn(),
        requeue: vi.fn(async () => ok(null)),
        openOutput: vi.fn(async () => ok(null)),
        openMedia: vi.fn(async () => ok(null)),
        openFolder: vi.fn(async () => ok(null)),
        copySource: vi.fn(async () => ok(null)),
        onChanged: vi.fn((listener: (event: HistoryChangedEvent) => void) => {
          onChanged = listener;
          return () => {
            onChanged = null;
          };
        })
      }
    }
  });

  return {
    getMock,
    emitChanged: () => onChanged?.({ totalCount: entries.length }),
    prependEntries: (...nextEntries) => {
      entries = [...nextEntries, ...entries];
    },
    replaceEntries: (nextEntries) => {
      entries = [...nextEntries];
    }
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
  useHistoryStore.setState({
    entries: [],
    totalCount: 0,
    loadedCount: 0,
    isSubscribed: false,
    isLoadingInitial: false,
    isLoadingMore: false,
    hasOpenedPanel: false,
    error: undefined
  });
  useUiStore.setState({
    activePanel: 'metadata',
    previousMediaPanel: 'metadata',
    activeContent: 'exportSettings',
    activeExportTarget: null,
    previewExportSettings: DEFAULT_EXPORT_SETTINGS,
    lastEditableExportSettings: DEFAULT_EXPORT_SETTINGS,
    mediaOverviewWidthPercent: 30
  });
});

describe('useHistoryStore paging', () => {
  it('loads only the newest 10 history entries at startup', async () => {
    const historyMock = installHistoryMock(createEntries(25));

    await useHistoryStore.getState().load();

    expect(historyMock.getMock).toHaveBeenCalledWith({ offset: 0, limit: 10 });
    expect(useHistoryStore.getState().entries).toHaveLength(10);
    expect(useHistoryStore.getState().totalCount).toBe(25);
    expect(useHistoryStore.getState().loadedCount).toBe(10);
  });

  it('loads 10 more entries when requested after the panel has opened', async () => {
    const historyMock = installHistoryMock(createEntries(25));

    await useHistoryStore.getState().load();
    useHistoryStore.getState().markOpened();
    await useHistoryStore.getState().loadMore();

    expect(historyMock.getMock).toHaveBeenLastCalledWith({ offset: 0, limit: 20 });
    expect(useHistoryStore.getState().entries).toHaveLength(20);
    expect(useHistoryStore.getState().loadedCount).toBe(20);
  });

  it('keeps only the latest 10 entries on live updates before History is first opened', async () => {
    const historyMock = installHistoryMock(createEntries(25));

    await useHistoryStore.getState().load();
    useHistoryStore.getState().subscribe();

    historyMock.prependEntries(historyEntry('newest', -1));
    historyMock.emitChanged();
    await flushAsyncWork();

    expect(historyMock.getMock).toHaveBeenLastCalledWith({ offset: 0, limit: 10 });
    expect(useHistoryStore.getState().entries).toHaveLength(10);
    expect(useHistoryStore.getState().entries[0]?.id).toBe('newest');
  });

  it('preserves the already loaded range on live updates after History has opened', async () => {
    const historyMock = installHistoryMock(createEntries(25));

    await useHistoryStore.getState().load();
    useHistoryStore.getState().subscribe();
    useHistoryStore.getState().markOpened();
    await useHistoryStore.getState().loadMore();

    historyMock.prependEntries(historyEntry('newest-1', -1), historyEntry('newest-2', -2));
    historyMock.emitChanged();
    await flushAsyncWork();

    expect(historyMock.getMock).toHaveBeenLastCalledWith({ offset: 0, limit: 22 });
    expect(useHistoryStore.getState().entries).toHaveLength(22);
    expect(useHistoryStore.getState().entries[0]?.id).toBe('newest-1');
    expect(useHistoryStore.getState().entries[1]?.id).toBe('newest-2');
    expect(useHistoryStore.getState().entries[21]?.id).toBe('item-20');
  });

  it('refreshes the visible range after remove without waiting for a change event', async () => {
    const historyMock = installHistoryMock(createEntries(25));

    await useHistoryStore.getState().load();
    await useHistoryStore.getState().remove('item-1');

    expect(historyMock.getMock).toHaveBeenLastCalledWith({ offset: 0, limit: 10 });
    expect(useHistoryStore.getState().entries[0]?.id).toBe('item-2');
    expect(useHistoryStore.getState().totalCount).toBe(24);
  });

  it('clears the active history selection when a refresh removes that entry from the loaded range', async () => {
    const historyMock = installHistoryMock(createEntries(25));

    await useHistoryStore.getState().load();
    useHistoryStore.getState().subscribe();
    useHistoryStore.getState().markOpened();
    await useHistoryStore.getState().loadMore();
    useUiStore.getState().setActiveExportTarget({ type: 'history', entryId: 'item-15' });

    historyMock.replaceEntries(createEntries(5));
    historyMock.emitChanged();
    await flushAsyncWork();

    expect(useUiStore.getState().activeExportTarget).toBeNull();
    expect(useHistoryStore.getState().entries).toHaveLength(5);
  });
});
