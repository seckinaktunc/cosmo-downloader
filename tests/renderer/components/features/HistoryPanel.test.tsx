import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_EXPORT_SETTINGS } from '@shared/defaults';
import type {
  AppSettings,
  DownloadHistoryEntry,
  DownloadHistoryStatus,
  VideoMetadata
} from '@shared/types';
import { useHistoryStore } from '@renderer/stores/historyStore';
import { useUiStore } from '@renderer/stores/uiStore';

type CapturedInteractiveItemPanelProps = Record<string, unknown> | null;

let capturedProps: CapturedInteractiveItemPanelProps = null;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}));

vi.mock('@renderer/components/ui/InteractiveItemPanel', () => ({
  InteractiveItemPanel: (props: Record<string, unknown>) => {
    capturedProps = props;
    return null;
  }
}));

const { HistoryPanel } = await import('@renderer/components/features/HistoryPanel');

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
    title: `Title ${id}`,
    thumbnail: `https://example.com/${id}.jpg`,
    duration: 120,
    containers: [],
    videoCodecs: [],
    audioCodecs: [],
    fpsOptions: [],
    formats: []
  };
}

function historyEntry(id: string, status: DownloadHistoryStatus): DownloadHistoryEntry {
  return {
    id,
    metadata: metadata(id),
    exportSettings: DEFAULT_EXPORT_SETTINGS,
    settings,
    status,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    outputPath: status === 'completed' ? `/downloads/${id}.mp4` : undefined
  };
}

function renderHistoryPanel(entries: DownloadHistoryEntry[]): void {
  let currentEntries = [...entries];
  const removeMock = vi.fn(async ({ entryId }: { entryId: string }) => {
    currentEntries = currentEntries.filter((entry) => entry.id !== entryId);
    return { ok: true, data: null };
  });

  vi.stubGlobal('window', {
    cosmo: {
      history: {
        get: vi.fn(async () => ({
          ok: true,
          data: {
            entries: currentEntries,
            totalCount: currentEntries.length
          }
        })),
        remove: removeMock,
        removeMany: vi.fn(async ({ entryIds }: { entryIds: string[] }) => {
          const selectedIds = new Set(entryIds);
          currentEntries = currentEntries.filter((entry) => !selectedIds.has(entry.id));
          return { ok: true, data: null };
        }),
        clear: vi.fn(async () => {
          currentEntries = [];
          return { ok: true, data: null };
        }),
        recordFetch: vi.fn(),
        requeue: vi.fn(async () => ({ ok: true, data: null })),
        openOutput: vi.fn(async () => ({ ok: true, data: null })),
        openMedia: vi.fn(async () => ({ ok: true, data: null })),
        openFolder: vi.fn(async () => ({ ok: true, data: null })),
        copySource: vi.fn(async () => ({ ok: true, data: null })),
        onChanged: vi.fn()
      }
    }
  });

  useHistoryStore.setState({
    entries,
    totalCount: entries.length,
    loadedCount: entries.length,
    isSubscribed: false,
    isLoadingInitial: false,
    isLoadingMore: false,
    hasOpenedPanel: false,
    error: undefined
  });

  useUiStore.setState({
    activePanel: 'history',
    previousMediaPanel: 'metadata',
    activeContent: 'exportSettings',
    activeExportTarget: null,
    previewExportSettings: DEFAULT_EXPORT_SETTINGS,
    lastEditableExportSettings: DEFAULT_EXPORT_SETTINGS,
    mediaOverviewWidthPercent: 30
  });

  capturedProps = null;
  renderToStaticMarkup(<HistoryPanel isActive />);
}

beforeEach(() => {
  capturedProps = null;
  vi.unstubAllGlobals();
});

describe('HistoryPanel', () => {
  it('passes a queue-style hover remove quick action for all history statuses', () => {
    const entries = [
      historyEntry('fetched-entry', 'fetched'),
      historyEntry('completed-entry', 'completed'),
      historyEntry('failed-entry', 'failed'),
      historyEntry('fetch-failed-entry', 'fetch_failed')
    ];

    renderHistoryPanel(entries);

    const getTopRightAction = capturedProps?.getTopRightAction as
      | ((entry: DownloadHistoryEntry) => { icon: string; label: string; onSelect: () => void })
      | undefined;

    expect(getTopRightAction).toBeTypeOf('function');

    for (const entry of entries) {
      expect(getTopRightAction?.(entry)).toMatchObject({
        icon: 'close',
        label: 'queue.actions.remove'
      });
    }
  });

  it('uses the existing remove flow when the hover remove action is triggered', async () => {
    const entry = historyEntry('removable-entry', 'completed');
    renderHistoryPanel([entry]);

    const getTopRightAction = capturedProps?.getTopRightAction as
      | ((entry: DownloadHistoryEntry) => { onSelect: () => void })
      | undefined;

    getTopRightAction?.(entry).onSelect();

    expect(window.cosmo.history.remove).toHaveBeenCalledWith({ entryId: entry.id });
  });

  it('keeps existing history menu and thumbnail remove actions unchanged', async () => {
    const entry = historyEntry('menu-entry', 'completed');
    renderHistoryPanel([entry]);

    const getActions = capturedProps?.getActions as
      | ((entry: DownloadHistoryEntry) => Array<{ id: string; icon: string; label: string; onSelect: () => void }>)
      | undefined;
    const getThumbnailActions = capturedProps?.getThumbnailActions as
      | ((entry: DownloadHistoryEntry) => Array<{ id: string; icon: string; label: string; onSelect: () => Promise<boolean> }>)
      | undefined;

    const menuRemoveAction = getActions?.(entry).find((action) => action.id === 'remove');
    const thumbnailRemoveAction = getThumbnailActions?.(entry).find((action) => action.id === 'remove');

    expect(menuRemoveAction).toMatchObject({
      icon: 'trash',
      label: 'queue.actions.remove'
    });
    expect(thumbnailRemoveAction).toMatchObject({
      icon: 'trash',
      label: 'queue.actions.remove'
    });

    await thumbnailRemoveAction?.onSelect();

    expect(window.cosmo.history.remove).toHaveBeenCalledWith({ entryId: entry.id });
  });
});
