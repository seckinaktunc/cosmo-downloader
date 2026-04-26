import type {
  DownloadHistoryEntry,
  MetadataFetchLifecycleEvent,
  QueueItem
} from '../../../shared/types';
import type { ActiveExportTarget, Content } from '../stores/uiStore';

export type DownloadLogSourceKind = 'history' | 'queue' | 'preview';

export type DownloadLogSource = {
  id: string;
  logPath: string;
  title: string;
  status: string;
  source: DownloadLogSourceKind;
  timestamp?: string;
  selected: boolean;
};

type ResolveDisplayedLogSourceInput = {
  activeExportTarget: ActiveExportTarget | null;
  queueItems: QueueItem[];
  historyEntries: DownloadHistoryEntry[];
  previewFetchLog: MetadataFetchLifecycleEvent | null;
  titleFallback: string;
};

function toSortTime(timestamp: string | undefined): number {
  if (!timestamp) {
    return 0;
  }

  const time = Date.parse(timestamp);
  return Number.isFinite(time) ? time : 0;
}

export function getQueueLogPath(item: QueueItem): string | undefined {
  return item.logPath ?? item.progress?.logPath;
}

function createQueueSource(
  item: QueueItem,
  titleFallback: string,
  selected: boolean
): DownloadLogSource | null {
  const logPath = getQueueLogPath(item);
  if (!logPath) {
    return null;
  }

  return {
    id: `queue:${item.id}`,
    logPath,
    title: item.metadata.title || titleFallback,
    status: item.status,
    source: 'queue',
    timestamp: item.updatedAt || item.createdAt,
    selected
  };
}

function createHistorySource(
  entry: DownloadHistoryEntry,
  titleFallback: string,
  selected: boolean
): DownloadLogSource | null {
  if (!entry.logPath) {
    return null;
  }

  return {
    id: `history:${entry.id}`,
    logPath: entry.logPath,
    title: entry.metadata.title || titleFallback,
    status: entry.status,
    source: 'history',
    timestamp: entry.updatedAt || entry.createdAt,
    selected
  };
}

function createPreviewSource(
  previewFetchLog: MetadataFetchLifecycleEvent,
  titleFallback: string
): DownloadLogSource | null {
  if (!previewFetchLog.logPath) {
    return null;
  }

  return {
    id: `preview:${previewFetchLog.requestId}`,
    logPath: previewFetchLog.logPath,
    title: previewFetchLog.url || titleFallback,
    status: previewFetchLog.state,
    source: 'preview',
    timestamp: previewFetchLog.timestamp,
    selected: false
  };
}

function newestSource(sources: DownloadLogSource[]): DownloadLogSource | null {
  return [...sources].sort((a, b) => toSortTime(b.timestamp) - toSortTime(a.timestamp))[0] ?? null;
}

export function resolveDisplayedLogSource({
  activeExportTarget,
  queueItems,
  historyEntries,
  previewFetchLog,
  titleFallback
}: ResolveDisplayedLogSourceInput): DownloadLogSource | null {
  if (activeExportTarget?.type === 'queue') {
    const item = queueItems.find((candidate) => candidate.id === activeExportTarget.itemId);
    if (item) {
      const source = createQueueSource(item, titleFallback, true);
      if (source) {
        return source;
      }
    }
  }

  if (activeExportTarget?.type === 'history') {
    const entry = historyEntries.find((candidate) => candidate.id === activeExportTarget.entryId);
    if (entry) {
      const source = createHistorySource(entry, titleFallback, true);
      if (source) {
        return source;
      }
    }
  }

  const previewSource = previewFetchLog
    ? createPreviewSource(previewFetchLog, titleFallback)
    : null;
  if (previewSource) {
    return previewSource;
  }

  return newestSource([
    ...queueItems.flatMap((item) => {
      const source = createQueueSource(item, titleFallback, false);
      return source ? [source] : [];
    }),
    ...historyEntries.flatMap((entry) => {
      const source = createHistorySource(entry, titleFallback, false);
      return source ? [source] : [];
    })
  ]);
}

export function getContentAfterItemActivation(activeContent: Content): Content {
  return activeContent === 'logs' ? 'logs' : 'exportSettings';
}
