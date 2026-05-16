import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_EXPORT_SETTINGS } from '@shared/defaults';
import type {
  AppSettings,
  DownloadHistoryEntry,
  QueueItem,
  VideoMetadata
} from '@shared/types';

const capturedButtons: Array<Record<string, unknown>> = [];

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

function metadata(id: string): VideoMetadata {
  return {
    requestId: id,
    url: `https://example.com/${id}`,
    webpageUrl: `https://example.com/watch/${id}`,
    title: `Video ${id}`,
    uploader: `Uploader ${id}`,
    uploaderUrl: `https://example.com/@${id}`,
    containers: [],
    videoCodecs: [],
    audioCodecs: [],
    fpsOptions: [],
    formats: []
  };
}

function historyEntry(id: string, status: DownloadHistoryEntry['status']): DownloadHistoryEntry {
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

function queueItem(id: string): QueueItem {
  return {
    id,
    metadata: metadata(id),
    exportSettings: DEFAULT_EXPORT_SETTINGS,
    settings,
    status: 'pending',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
}

let displayMetadata: VideoMetadata | null = null;
let downloadState: Record<string, unknown>;
let historyState: Record<string, unknown>;
let queueState: Record<string, unknown>;
let settingsState: Record<string, unknown>;
let uiState: Record<string, unknown>;
let videoState: Record<string, unknown>;

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next');
  return {
    ...actual,
    useTranslation: () => ({
      t: (
        key: string,
        options?: { count?: number; index?: number; total?: number; percent?: string }
      ) => {
        if (key === 'bottom.startQueue') {
          return `Start Queue (${options?.count ?? 0})`;
        }

        if (key === 'bottom.queueProgress') {
          return `Queue ${options?.index ?? 0} of ${options?.total ?? 0} (${options?.percent ?? '0%'})`;
        }

        if (key === 'bottom.startDownload') {
          return 'Start Download';
        }

        if (key === 'bottom.newVideo') {
          return 'New Video';
        }

        if (key === 'metadata.fetching') {
          return 'Fetching Metadata';
        }

        return key;
      }
    })
  };
});

vi.mock('@renderer/components/ui/Button', () => ({
  Button: (props: Record<string, unknown>) => {
    capturedButtons.push(props);
    return null;
  }
}));

vi.mock('@renderer/components/ui/Thumbnail', () => ({
  Thumbnail: () => null
}));

vi.mock('@renderer/components/miscellaneous/PlatformBadge', () => ({
  PlatformBadge: () => null
}));

vi.mock('@renderer/hooks/useDisplayMetadata', () => ({
  useDisplayMetadata: () => displayMetadata
}));

vi.mock('@renderer/stores/downloadStore', () => ({
  useDownloadStore: (selector: (state: typeof downloadState) => unknown) => selector(downloadState)
}));

vi.mock('@renderer/stores/historyStore', () => ({
  useHistoryStore: (selector: (state: typeof historyState) => unknown) => selector(historyState)
}));

vi.mock('@renderer/stores/queueStore', () => ({
  useQueueStore: (selector: (state: typeof queueState) => unknown) => selector(queueState)
}));

vi.mock('@renderer/stores/settingsStore', () => ({
  useSettingsStore: (selector: (state: typeof settingsState) => unknown) => selector(settingsState)
}));

vi.mock('@renderer/stores/uiStore', () => ({
  useUiStore: (selector: (state: typeof uiState) => unknown) => selector(uiState)
}));

vi.mock('@renderer/stores/videoStore', () => ({
  useVideoStore: (selector: (state: typeof videoState) => unknown) => selector(videoState)
}));

const { BottomBar } = await import('@renderer/components/layout/BottomBar');

function renderBottomBar(): void {
  capturedButtons.length = 0;
  renderToStaticMarkup(<BottomBar />);
}

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  capturedButtons.length = 0;
  displayMetadata = null;
  downloadState = {
    stage: 'idle',
    progress: null,
    cancel: vi.fn(async () => undefined),
    reset: vi.fn(),
    trackedPreviewQueueItemId: undefined,
    completedPreviewUrl: undefined,
    trackPreviewDownload: vi.fn(),
    markTrackedPreviewCompleted: vi.fn(),
    clearPreviewDownloadState: vi.fn()
  };
  historyState = {
    entries: [],
    requeue: vi.fn(async () => true),
    startDownload: vi.fn(async () => true),
    flushExportSettingsSaves: vi.fn(async () => undefined)
  };
  queueState = {
    items: [],
    activeItemId: undefined,
    progressById: {},
    paused: true,
    add: vi.fn(async () => null),
    start: vi.fn(async () => undefined),
    resume: vi.fn(async () => undefined),
    cancelActive: vi.fn(async () => undefined),
    flushExportSettingsSaves: vi.fn(async () => undefined)
  };
  settingsState = {
    settings
  };
  uiState = {
    activePanel: 'metadata',
    activeContent: 'exportSettings',
    activeExportTarget: null,
    previewExportSettings: DEFAULT_EXPORT_SETTINGS,
    openMediaPanel: vi.fn((panel: string) => {
      uiState.activePanel = panel;
    }),
    toggleMediaPanel: vi.fn()
  };
  videoState = {
    metadata: null,
    stage: 'idle',
    clear: vi.fn()
  };
});

describe('BottomBar history actions', () => {
  it('starts a selected editable history item directly when no queue work is pending', async () => {
    const directStartMock = vi.fn(async () => true);
    const queueAddMock = vi.fn(async () => null);
    const entry = historyEntry('editable-history', 'fetched');
    historyState.entries = [entry];
    historyState.startDownload = directStartMock;
    queueState.add = queueAddMock;
    uiState.activeExportTarget = { type: 'history', entryId: entry.id };
    videoState.metadata = metadata('preview-item');
    videoState.stage = 'ready';
    displayMetadata = entry.metadata;

    renderBottomBar();

    const onClick = capturedButtons[0]?.onClick as (() => void) | undefined;
    onClick?.();
    await flushAsyncWork();

    expect(directStartMock).toHaveBeenCalledWith(entry.id);
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it('flushes history and queue edits, requeues the selected history item, and starts the queue when pending work exists', async () => {
    const requeueMock = vi.fn(async () => true);
    const flushHistorySavesMock = vi.fn(async () => undefined);
    const flushQueueSavesMock = vi.fn(async () => undefined);
    const startQueueMock = vi.fn(async () => undefined);
    const queueAddMock = vi.fn(async () => null);
    const entry = historyEntry('failed-history', 'failed');
    historyState.entries = [entry];
    historyState.requeue = requeueMock;
    historyState.flushExportSettingsSaves = flushHistorySavesMock;
    queueState.items = [queueItem('queued-item')];
    queueState.paused = false;
    queueState.start = startQueueMock;
    queueState.flushExportSettingsSaves = flushQueueSavesMock;
    queueState.add = queueAddMock;
    uiState.activeExportTarget = { type: 'history', entryId: entry.id };
    videoState.metadata = metadata('preview-item');
    videoState.stage = 'ready';
    displayMetadata = entry.metadata;

    renderBottomBar();

    expect(capturedButtons[0]?.label).toBe('Start Queue (2)');

    const onClick = capturedButtons[0]?.onClick as (() => void) | undefined;
    onClick?.();
    await flushAsyncWork();

    expect(flushQueueSavesMock).toHaveBeenCalledTimes(1);
    expect(flushHistorySavesMock).toHaveBeenCalledTimes(1);
    expect(requeueMock).toHaveBeenCalledWith(entry.id);
    expect(startQueueMock).toHaveBeenCalledTimes(1);
    expect(queueAddMock).not.toHaveBeenCalled();
  });
});
