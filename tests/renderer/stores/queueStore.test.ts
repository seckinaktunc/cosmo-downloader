import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_EXPORT_SETTINGS } from '@shared/defaults';
import type {
  AppSettings,
  DownloadProgress,
  IpcResult,
  QueueItem,
  QueueProgressEvent,
  QueueSnapshot,
  VideoMetadata
} from '@shared/types';
import { useQueueStore } from '@renderer/stores/queueStore';
import { useUiStore } from '@renderer/stores/uiStore';

const settings: AppSettings = {
  hardwareAcceleration: true,
  automaticUpdates: true,
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
    metadata: true
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

function queueItem(id: string, status: QueueItem['status']): QueueItem {
  return {
    id,
    metadata: metadata(id),
    exportSettings: DEFAULT_EXPORT_SETTINGS,
    settings,
    status,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
}

function installQueueMock(initialSnapshot: QueueSnapshot): {
  emitSnapshot: (snapshot: QueueSnapshot) => void;
  emitProgress: (event: QueueProgressEvent) => void;
} {
  let snapshotListener: ((snapshot: QueueSnapshot) => void) | null = null;
  let progressListener: ((event: QueueProgressEvent) => void) | null = null;

  vi.stubGlobal('window', {
    cosmo: {
      queue: {
        get: vi.fn(async () => ok(initialSnapshot)),
        add: vi.fn(),
        start: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        cancelActive: vi.fn(),
        skipActive: vi.fn(),
        remove: vi.fn(),
        removeMany: vi.fn(),
        reorder: vi.fn(),
        move: vi.fn(),
        moveMany: vi.fn(),
        updateExportSettings: vi.fn(),
        retry: vi.fn(),
        clear: vi.fn(),
        onSnapshot: vi.fn((listener: (snapshot: QueueSnapshot) => void) => {
          snapshotListener = listener;
          return () => {
            snapshotListener = null;
          };
        }),
        onProgress: vi.fn((listener: (event: QueueProgressEvent) => void) => {
          progressListener = listener;
          return () => {
            progressListener = null;
          };
        })
      }
    }
  });

  return {
    emitSnapshot: (snapshot) => snapshotListener?.(snapshot),
    emitProgress: (event) => progressListener?.(event)
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
  useQueueStore.setState({
    items: [],
    activeItemId: undefined,
    paused: true,
    progressById: {},
    isSubscribed: false,
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

describe('useQueueStore runtime progress', () => {
  it('merges queue progress into progressById without replacing the item list', async () => {
    const activeItem = queueItem('item-1', 'active');
    const queueMock = installQueueMock({
      items: [activeItem],
      activeItemId: activeItem.id,
      paused: false
    });

    await useQueueStore.getState().load();
    useQueueStore.getState().subscribe();

    const initialItems = useQueueStore.getState().items;
    const progress: DownloadProgress = {
      stage: 'downloading',
      stageLabel: 'Downloading',
      percentage: 42,
      logPath: '/logs/item-1.log'
    };

    queueMock.emitProgress({
      itemId: activeItem.id,
      progress,
      logPath: progress.logPath,
      updatedAt: '2026-01-01T00:00:05.000Z',
      cleared: false
    });

    expect(useQueueStore.getState().items).toBe(initialItems);
    expect(useQueueStore.getState().progressById[activeItem.id]).toEqual(progress);
  });

  it('clears runtime progress when snapshots pause, fail, or remove an item', async () => {
    const activeItem = queueItem('item-1', 'active');
    const queueMock = installQueueMock({
      items: [activeItem],
      activeItemId: activeItem.id,
      paused: false
    });

    await useQueueStore.getState().load();
    useQueueStore.getState().subscribe();

    queueMock.emitProgress({
      itemId: activeItem.id,
      progress: {
        stage: 'downloading',
        stageLabel: 'Downloading',
        percentage: 12,
        logPath: '/logs/item-1.log'
      },
      logPath: '/logs/item-1.log',
      updatedAt: '2026-01-01T00:00:05.000Z',
      cleared: false
    });
    expect(useQueueStore.getState().progressById[activeItem.id]?.percentage).toBe(12);

    queueMock.emitSnapshot({
      items: [{ ...activeItem, status: 'paused', logPath: '/logs/item-1.log' }],
      activeItemId: undefined,
      paused: true
    });
    expect(useQueueStore.getState().progressById[activeItem.id]).toBeUndefined();

    queueMock.emitProgress({
      itemId: activeItem.id,
      progress: {
        stage: 'downloading',
        stageLabel: 'Downloading',
        percentage: 24
      },
      logPath: '/logs/item-1.log',
      updatedAt: '2026-01-01T00:00:10.000Z',
      cleared: false
    });

    queueMock.emitSnapshot({
      items: [{ ...activeItem, status: 'failed', error: 'ffmpeg failed' }],
      activeItemId: undefined,
      paused: false
    });
    expect(useQueueStore.getState().progressById[activeItem.id]).toBeUndefined();

    queueMock.emitProgress({
      itemId: activeItem.id,
      progress: {
        stage: 'downloading',
        stageLabel: 'Downloading',
        percentage: 90
      },
      logPath: '/logs/item-1.log',
      updatedAt: '2026-01-01T00:00:15.000Z',
      cleared: false
    });

    queueMock.emitSnapshot({
      items: [],
      activeItemId: undefined,
      paused: false
    });
    expect(useQueueStore.getState().progressById[activeItem.id]).toBeUndefined();
  });

  it('clears runtime progress immediately when a cleared progress event arrives', async () => {
    const activeItem = queueItem('item-1', 'active');
    const queueMock = installQueueMock({
      items: [activeItem],
      activeItemId: activeItem.id,
      paused: false
    });

    await useQueueStore.getState().load();
    useQueueStore.getState().subscribe();

    queueMock.emitProgress({
      itemId: activeItem.id,
      progress: {
        stage: 'downloading',
        stageLabel: 'Downloading',
        percentage: 64
      },
      logPath: '/logs/item-1.log',
      updatedAt: '2026-01-01T00:00:05.000Z',
      cleared: false
    });
    queueMock.emitProgress({
      itemId: activeItem.id,
      progress: undefined,
      logPath: '/logs/item-1.log',
      updatedAt: '2026-01-01T00:00:06.000Z',
      cleared: true
    });

    expect(useQueueStore.getState().progressById[activeItem.id]).toBeUndefined();
  });
});
