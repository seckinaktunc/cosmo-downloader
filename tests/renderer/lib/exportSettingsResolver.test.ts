import { describe, expect, it } from 'vitest';
import { DEFAULT_EXPORT_SETTINGS } from '@shared/defaults';
import type {
  DownloadHistoryEntry,
  ExportSettings,
  QueueItem,
  QueueItemStatus,
  VideoMetadata
} from '@shared/types';
import {
  isQueueExportEditable,
  resolveExportSettingsTarget
} from '@renderer/lib/exportSettingsResolver';

const settings: ExportSettings = {
  ...DEFAULT_EXPORT_SETTINGS,
  outputFormat: 'mkv',
  savePath: '/downloads/example.webm'
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

function queueItem(id: string, status: QueueItemStatus, exportSettings = settings): QueueItem {
  return {
    id,
    metadata: metadata(id),
    exportSettings,
    settings: {
      hardwareAcceleration: true,
      automaticUpdates: true,
      createFolderPerDownload: false,
      defaultDownloadLocation: '/downloads',
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
    },
    status,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
}

function historyEntry(id: string): DownloadHistoryEntry {
  const item = queueItem(id, 'completed');
  return {
    id,
    metadata: item.metadata,
    exportSettings: item.exportSettings,
    settings: item.settings,
    status: 'completed',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

describe('exportSettingsResolver', () => {
  it('marks only retryable queue states as editable', () => {
    expect(isQueueExportEditable('pending')).toBe(true);
    expect(isQueueExportEditable('paused')).toBe(true);
    expect(isQueueExportEditable('failed')).toBe(true);
    expect(isQueueExportEditable('cancelled')).toBe(true);
    expect(isQueueExportEditable('active')).toBe(false);
    expect(isQueueExportEditable('completed')).toBe(false);
  });

  it('resolves preview settings when preview metadata exists', () => {
    const resolved = resolveExportSettingsTarget({
      activeTarget: { type: 'preview' },
      previewMetadata: metadata('preview'),
      previewExportSettings: settings,
      queueItems: [],
      historyEntries: []
    });

    expect(resolved.exportSettings).toBe(settings);
    expect(resolved.locationDisplayPath).toBe(settings.savePath);
    expect(resolved.locationDisplayMode).toBe('effective');
    expect(resolved.readOnly).toBe(false);
    expect(resolved.metadata?.title).toBe('preview');
  });

  it('resolves editable queue settings for pending items', () => {
    const item = queueItem('queued', 'pending');
    const resolved = resolveExportSettingsTarget({
      activeTarget: { type: 'queue', itemId: item.id },
      previewMetadata: metadata('preview'),
      previewExportSettings: DEFAULT_EXPORT_SETTINGS,
      queueItems: [item],
      historyEntries: []
    });

    expect(resolved.exportSettings).toBe(settings);
    expect(resolved.locationDisplayPath).toBe(settings.savePath);
    expect(resolved.locationDisplayMode).toBe('effective');
    expect(resolved.readOnly).toBe(false);
  });

  it('keeps completed history entries read-only', () => {
    const entry = {
      ...historyEntry('history'),
      outputPath: '/downloads/history/final export.mp4'
    };
    const resolved = resolveExportSettingsTarget({
      activeTarget: { type: 'history', entryId: entry.id },
      previewMetadata: metadata('preview'),
      previewExportSettings: DEFAULT_EXPORT_SETTINGS,
      queueItems: [],
      historyEntries: [entry]
    });

    expect(resolved.exportSettings).toBe(settings);
    expect(resolved.locationDisplayPath).toBe(entry.outputPath);
    expect(resolved.locationDisplayMode).toBe('raw');
    expect(resolved.readOnly).toBe(true);
    expect(resolved.editable).toBe(false);
  });

  it('falls back to the saved export path when history output path is unavailable', () => {
    const entry = {
      ...historyEntry('history'),
      outputPath: undefined
    };
    const resolved = resolveExportSettingsTarget({
      activeTarget: { type: 'history', entryId: entry.id },
      previewMetadata: metadata('preview'),
      previewExportSettings: DEFAULT_EXPORT_SETTINGS,
      queueItems: [],
      historyEntries: [entry]
    });

    expect(resolved.locationDisplayPath).toBe(settings.savePath);
    expect(resolved.locationDisplayMode).toBe('effective');
    expect(resolved.readOnly).toBe(true);
  });

  it('keeps the placeholder state when history has no output path or save path', () => {
    const entry = {
      ...historyEntry('history'),
      outputPath: undefined,
      exportSettings: {
        ...settings,
        savePath: undefined
      }
    };
    const resolved = resolveExportSettingsTarget({
      activeTarget: { type: 'history', entryId: entry.id },
      previewMetadata: metadata('preview'),
      previewExportSettings: DEFAULT_EXPORT_SETTINGS,
      queueItems: [],
      historyEntries: [entry]
    });

    expect(resolved.locationDisplayPath).toBeUndefined();
    expect(resolved.locationDisplayMode).toBe('effective');
    expect(resolved.readOnly).toBe(true);
  });

  it.each(['fetched', 'failed', 'cancelled'] as const)(
    'resolves %s history entries as editable',
    (status) => {
      const entry = {
        ...historyEntry(`history-${status}`),
        status
      };
      const resolved = resolveExportSettingsTarget({
        activeTarget: { type: 'history', entryId: entry.id },
        previewMetadata: metadata('preview'),
        previewExportSettings: DEFAULT_EXPORT_SETTINGS,
        queueItems: [],
        historyEntries: [entry]
      });

      expect(resolved.readOnly).toBe(false);
      expect(resolved.editable).toBe(true);
    }
  );

  it.each(['fetch_failed', 'started', 'completed'] as const)(
    'resolves %s history entries as read-only',
    (status) => {
      const entry = {
        ...historyEntry(`history-${status}`),
        status
      };
      const resolved = resolveExportSettingsTarget({
        activeTarget: { type: 'history', entryId: entry.id },
        previewMetadata: metadata('preview'),
        previewExportSettings: DEFAULT_EXPORT_SETTINGS,
        queueItems: [],
        historyEntries: [entry]
      });

      expect(resolved.readOnly).toBe(true);
      expect(resolved.editable).toBe(false);
    }
  );
});
