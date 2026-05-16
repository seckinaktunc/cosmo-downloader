import { DEFAULT_EXPORT_SETTINGS } from '../../../shared/defaults';
import { isHistoryEntryEditable } from '../../../shared/historyEntryCapabilities';
import type {
  DownloadHistoryEntry,
  ExportSettings,
  QueueItem,
  QueueItemStatus,
  VideoMetadata
} from '../../../shared/types';
import type { ActiveExportTarget } from '../stores/uiStore';

export type ResolvedExportSettingsTarget = {
  target: ActiveExportTarget | null;
  metadata: VideoMetadata | null;
  exportSettings: ExportSettings;
  locationDisplayPath?: string;
  locationDisplayMode: 'effective' | 'raw';
  readOnly: boolean;
  editable: boolean;
};

type ExportSettingsTargetLabels = {
  queuedEditable: string;
  queuedReadOnly: string;
  historyReadOnly: string;
  previewEditable: string;
  unavailable: string;
};

export function isQueueExportEditable(status: QueueItemStatus): boolean {
  return (
    status === 'pending' || status === 'paused' || status === 'failed' || status === 'cancelled'
  );
}

export function resolveExportSettingsTarget({
  activeTarget,
  previewMetadata,
  previewExportSettings,
  queueItems,
  historyEntries
}: {
  activeTarget: ActiveExportTarget | null;
  previewMetadata: VideoMetadata | null;
  previewExportSettings: ExportSettings;
  queueItems: QueueItem[];
  historyEntries: DownloadHistoryEntry[];
  labels?: ExportSettingsTargetLabels;
}): ResolvedExportSettingsTarget {
  if (activeTarget?.type === 'queue') {
    const item = queueItems.find((candidate) => candidate.id === activeTarget.itemId);
    if (item) {
      const editable = isQueueExportEditable(item.status);
      return {
        target: activeTarget,
        metadata: item.metadata,
        exportSettings: item.exportSettings,
        locationDisplayPath: item.exportSettings.savePath,
        locationDisplayMode: 'effective',
        readOnly: !editable,
        editable
      };
    }
  }

  if (activeTarget?.type === 'history') {
    const entry = historyEntries.find((candidate) => candidate.id === activeTarget.entryId);
    if (entry) {
      const editable = isHistoryEntryEditable(entry.status);
      return {
        target: activeTarget,
        metadata: entry.metadata,
        exportSettings: entry.exportSettings,
        locationDisplayPath: entry.outputPath ?? entry.exportSettings.savePath,
        locationDisplayMode: entry.outputPath ? 'raw' : 'effective',
        readOnly: !editable,
        editable
      };
    }
  }

  if (previewMetadata) {
    return {
      target: { type: 'preview' },
      metadata: previewMetadata,
      exportSettings: previewExportSettings,
      locationDisplayPath: previewExportSettings.savePath,
      locationDisplayMode: 'effective',
      readOnly: false,
      editable: true
    };
  }

  return {
    target: null,
    metadata: null,
    exportSettings: DEFAULT_EXPORT_SETTINGS,
    locationDisplayPath: undefined,
    locationDisplayMode: 'effective',
    readOnly: true,
    editable: false
  };
}
