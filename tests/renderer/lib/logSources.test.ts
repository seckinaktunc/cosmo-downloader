import { describe, expect, it } from 'vitest';
import { DEFAULT_EXPORT_SETTINGS } from '@shared/defaults';
import type {
  AppSettings,
  DownloadHistoryEntry,
  MetadataFetchLifecycleEvent,
  QueueItem,
  VideoMetadata
} from '@shared/types';
import { getContentAfterItemActivation, resolveDisplayedLogSource } from '@renderer/lib/logSources';

const settings: AppSettings = {
  hardwareAcceleration: true,
  automaticUpdates: true,
  alwaysAskDownloadLocation: false,
  createFolderPerDownload: false,
  defaultDownloadLocation: '/downloads',
  interfaceLanguage: 'en_US',
  cookiesBrowser: 'none',
  alwaysOnTop: false
};

function metadata(title: string): VideoMetadata {
  return {
    requestId: title,
    url: `https://example.com/${title}`,
    title,
    containers: [],
    videoCodecs: [],
    audioCodecs: [],
    fpsOptions: [],
    formats: []
  };
}

function queueItem(
  id: string,
  logPath: string | undefined,
  updatedAt = '2026-04-20T10:00:00.000Z'
): QueueItem {
  return {
    id,
    metadata: metadata(id),
    exportSettings: DEFAULT_EXPORT_SETTINGS,
    settings,
    status: 'failed',
    createdAt: updatedAt,
    updatedAt,
    logPath
  };
}

function historyEntry(
  id: string,
  logPath: string | undefined,
  updatedAt = '2026-04-20T09:00:00.000Z'
): DownloadHistoryEntry {
  return {
    id,
    metadata: metadata(id),
    exportSettings: DEFAULT_EXPORT_SETTINGS,
    settings,
    status: 'failed',
    createdAt: updatedAt,
    updatedAt,
    logPath
  };
}

function previewFetchLog(
  requestId: string,
  logPath: string,
  timestamp = '2026-04-22T09:00:00.000Z'
): MetadataFetchLifecycleEvent {
  return {
    requestId,
    url: `https://example.com/watch/${requestId}`,
    logPath,
    state: 'started',
    timestamp
  };
}

describe('resolveDisplayedLogSource', () => {
  it('uses the selected queue item log before the newest fallback log', () => {
    const source = resolveDisplayedLogSource({
      activeExportTarget: { type: 'queue', itemId: 'selected' },
      queueItems: [
        queueItem('selected', '/logs/selected.log', '2026-04-20T10:00:00.000Z'),
        queueItem('newest', '/logs/newest.log', '2026-04-21T10:00:00.000Z')
      ],
      historyEntries: [],
      previewFetchLog: previewFetchLog('preview', '/logs/preview.log'),
      titleFallback: 'Unknown download'
    });

    expect(source?.logPath).toBe('/logs/selected.log');
    expect(source?.source).toBe('queue');
    expect(source?.selected).toBe(true);
  });

  it('uses the selected history entry log before the newest fallback log', () => {
    const source = resolveDisplayedLogSource({
      activeExportTarget: { type: 'history', entryId: 'selected' },
      queueItems: [queueItem('newest', '/logs/newest.log', '2026-04-21T10:00:00.000Z')],
      historyEntries: [historyEntry('selected', '/logs/selected.log', '2026-04-20T10:00:00.000Z')],
      previewFetchLog: previewFetchLog('preview', '/logs/preview.log'),
      titleFallback: 'Unknown download'
    });

    expect(source?.logPath).toBe('/logs/selected.log');
    expect(source?.source).toBe('history');
    expect(source?.selected).toBe(true);
  });

  it('uses the newest queue or history log when there is no selected log', () => {
    const source = resolveDisplayedLogSource({
      activeExportTarget: { type: 'queue', itemId: 'missing-log' },
      queueItems: [
        queueItem('missing-log', undefined, '2026-04-22T10:00:00.000Z'),
        queueItem('older-queue', '/logs/older-queue.log', '2026-04-20T10:00:00.000Z')
      ],
      historyEntries: [
        historyEntry('newest-history', '/logs/newest-history.log', '2026-04-21T10:00:00.000Z')
      ],
      previewFetchLog: null,
      titleFallback: 'Unknown download'
    });

    expect(source?.logPath).toBe('/logs/newest-history.log');
    expect(source?.selected).toBe(false);
  });

  it('uses the active preview fetch log when no explicit queue or history log is selected', () => {
    const source = resolveDisplayedLogSource({
      activeExportTarget: null,
      queueItems: [queueItem('older-queue', '/logs/older-queue.log', '2026-04-20T10:00:00.000Z')],
      historyEntries: [
        historyEntry('older-history', '/logs/older-history.log', '2026-04-21T10:00:00.000Z')
      ],
      previewFetchLog: previewFetchLog('preview', '/logs/preview.log'),
      titleFallback: 'Unknown download'
    });

    expect(source?.source).toBe('preview');
    expect(source?.logPath).toBe('/logs/preview.log');
    expect(source?.selected).toBe(false);
  });
});

describe('getContentAfterItemActivation', () => {
  it('preserves logs content when queue or history rows are selected from Logs', () => {
    expect(getContentAfterItemActivation('logs')).toBe('logs');
  });

  it('opens export content for row selection from other content', () => {
    expect(getContentAfterItemActivation('preferences')).toBe('exportSettings');
    expect(getContentAfterItemActivation(null)).toBe('exportSettings');
  });
});
