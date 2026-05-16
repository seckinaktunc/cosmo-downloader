import { app, webContents, type WebContents } from 'electron';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { IPC_CHANNELS } from '../../shared/ipc';
import { mergeExportSettings } from '../../shared/defaults';
import type {
  DownloadHistoryEntry,
  DownloadProgress,
  IpcResult,
  QueueAddRequest,
  QueueBulkRequest,
  QueueExportSettingsUpdateRequest,
  QueueItem,
  QueueMoveManyRequest,
  QueueMoveRequest,
  QueueProgressEvent,
  QueueReorderRequest,
  QueueSnapshot
} from '../../shared/types';
import { DownloadService } from './downloadService';
import { HistoryService } from './historyService';
import { movePendingItem, movePendingItems, removeManyQueueItems } from '../../shared/queueModel';
import { fail, ok } from '../utils/ipcResult';
import { BufferedJsonFile, loadJsonFileState } from '../utils/jsonFileState';

const QUEUE_FILE = 'queue.json';

type LoadedQueueItems = {
  items: QueueItem[];
  needsRewrite: boolean;
};

const QUEUE_STATUSES = new Set<QueueItem['status']>([
  'pending',
  'active',
  'paused',
  'completed',
  'failed',
  'cancelled'
]);

function now(): string {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

function createQueueSnapshotItem(item: QueueItem): QueueItem {
  const snapshotItem = { ...item };
  delete snapshotItem.progress;
  return snapshotItem;
}

function deserializeItems(value: unknown): LoadedQueueItems {
  if (!Array.isArray(value)) {
    return { items: [], needsRewrite: true };
  }

  let needsRewrite = false;
  const items: QueueItem[] = [];

  for (const item of value) {
    if (!(isRecord(item) && typeof item.id === 'string' && isRecord(item.metadata))) {
      needsRewrite = true;
      continue;
    }

    const status = QUEUE_STATUSES.has(item.status as QueueItem['status'])
      ? (item.status as QueueItem['status'])
      : 'pending';
    const exportSettings = mergeExportSettings(item.exportSettings);
    const hadRuntimeProgress = item.progress != null;

    if (status !== item.status || hadRuntimeProgress) {
      needsRewrite = true;
    }

    if (status === 'completed' || status === 'cancelled') {
      needsRewrite = true;
      continue;
    }

    const normalizedStatus = status === 'active' ? 'paused' : status;
    if (normalizedStatus !== status) {
      needsRewrite = true;
    }

    if (JSON.stringify(exportSettings) !== JSON.stringify(item.exportSettings ?? null)) {
      needsRewrite = true;
    }

    items.push({
      id: item.id,
      metadata: item.metadata as QueueItem['metadata'],
      exportSettings,
      settings: item.settings as QueueItem['settings'],
      status: normalizedStatus,
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : now(),
      progress: undefined,
      updatedAt:
        normalizedStatus !== status
          ? now()
          : typeof item.updatedAt === 'string'
            ? item.updatedAt
            : typeof item.createdAt === 'string'
              ? item.createdAt
              : now(),
      outputPath: typeof item.outputPath === 'string' ? item.outputPath : undefined,
      requestedOutputPath:
        typeof item.requestedOutputPath === 'string' ? item.requestedOutputPath : undefined,
      logPath: typeof item.logPath === 'string' ? item.logPath : undefined,
      error: typeof item.error === 'string' ? item.error : undefined,
      historyEntryId: typeof item.historyEntryId === 'string' ? item.historyEntryId : undefined
    });
  }

  return { items, needsRewrite };
}

function loadItems(filePath: string): ReturnType<typeof loadJsonFileState<LoadedQueueItems>> {
  return loadJsonFileState(filePath, {
    createFallback: () => ({ items: [], needsRewrite: false }),
    deserialize: deserializeItems
  });
}

export class QueueService {
  private items: QueueItem[];
  private paused = true;
  private running = false;
  private pauseRequested = false;
  private cancelRequested = false;
  private skipRequested = false;
  private activeWebContents: WebContents | null = null;
  private readonly persistence: BufferedJsonFile<QueueItem[]>;

  constructor(
    private readonly downloadService: DownloadService,
    private readonly historyService: HistoryService,
    private readonly filePath: string = join(app.getPath('userData'), QUEUE_FILE)
  ) {
    const loaded = loadItems(filePath);
    this.items = loaded.value.items;
    this.persistence = new BufferedJsonFile(this.filePath, {
      getValue: () => this.items.map((item) => createQueueSnapshotItem(item))
    });

    if (loaded.needsRewrite || loaded.wasMissing || loaded.value.needsRewrite) {
      void this.persistence.flushNow();
    }
  }

  getSnapshot(): QueueSnapshot {
    return {
      items: this.items.map((item) => createQueueSnapshotItem(item)),
      activeItemId: this.items.find((item) => item.status === 'active')?.id,
      paused: this.paused
    };
  }

  hasActiveItem(): boolean {
    return this.items.some((item) => item.status === 'active') || this.running;
  }

  async add(request: QueueAddRequest): Promise<IpcResult<QueueSnapshot>> {
    const requestedOutputPath = this.resolveRequestedOutputPath(request);
    const reusableHistoryEntry = this.historyService.findReusableFetchedByRequestId?.(
      request.metadata.requestId
    );
    const timestamp = now();
    const item: QueueItem = {
      id: randomUUID(),
      metadata: request.metadata,
      exportSettings: mergeExportSettings(request.exportSettings),
      settings: request.settings,
      requestedOutputPath,
      historyEntryId: reusableHistoryEntry?.id,
      status: 'pending',
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.items.push(item);
    this.schedulePersistAndBroadcast();
    return ok(this.getSnapshot());
  }

  addFromHistory(entry: DownloadHistoryEntry): IpcResult<QueueSnapshot> {
    const timestamp = now();
    this.items.push({
      id: randomUUID(),
      metadata: entry.metadata,
      exportSettings: mergeExportSettings(entry.exportSettings),
      settings: entry.settings,
      requestedOutputPath: entry.exportSettings.savePath,
      historyEntryId: entry.status === 'fetched' ? entry.id : undefined,
      status: 'pending',
      createdAt: timestamp,
      updatedAt: timestamp
    });
    this.schedulePersistAndBroadcast();
    return ok(this.getSnapshot());
  }

  start(sender: WebContents): IpcResult<QueueSnapshot> {
    this.activeWebContents = sender;
    this.paused = false;
    this.broadcastSnapshot();
    void this.startNext();
    return ok(this.getSnapshot());
  }

  resume(sender: WebContents): IpcResult<QueueSnapshot> {
    this.activeWebContents = sender;
    this.paused = false;
    const timestamp = now();
    this.items = this.items.map((item) =>
      item.status === 'paused' ? { ...item, status: 'pending', updatedAt: timestamp } : item
    );
    this.schedulePersistAndBroadcast();
    void this.startNext();
    return ok(this.getSnapshot());
  }

  pause(): IpcResult<QueueSnapshot> {
    this.paused = true;
    const active = this.getActiveItem();
    if (active) {
      this.pauseRequested = true;
      this.cancelRequested = false;
      this.skipRequested = false;
      this.downloadService.cancel();
    }
    this.broadcastSnapshot();
    return ok(this.getSnapshot());
  }

  cancelActive(): IpcResult<QueueSnapshot> {
    this.paused = true;
    const active = this.getActiveItem();
    if (active) {
      this.pauseRequested = false;
      this.cancelRequested = true;
      this.skipRequested = false;
      this.downloadService.cancel();
    }
    this.broadcastSnapshot();
    return ok(this.getSnapshot());
  }

  skipActive(): IpcResult<QueueSnapshot> {
    const active = this.getActiveItem();
    if (active) {
      this.pauseRequested = false;
      this.cancelRequested = false;
      this.skipRequested = true;
      this.downloadService.cancel();
    }
    this.broadcastSnapshot();
    return ok(this.getSnapshot());
  }

  remove(itemId: string): IpcResult<QueueSnapshot> {
    const item = this.items.find((candidate) => candidate.id === itemId);
    if (item?.status === 'active') {
      return fail('BUSY', 'The active queue item cannot be removed.');
    }

    this.items = this.items.filter((candidate) => candidate.id !== itemId);
    this.schedulePersistAndBroadcast();
    return ok(this.getSnapshot());
  }

  removeMany(request: QueueBulkRequest): IpcResult<QueueSnapshot> {
    this.items = removeManyQueueItems(this.items, request.itemIds);
    this.schedulePersistAndBroadcast();
    return ok(this.getSnapshot());
  }

  async retry(itemId: string): Promise<IpcResult<QueueSnapshot>> {
    const item = this.items.find((candidate) => candidate.id === itemId);
    if (!item || !['failed', 'cancelled', 'paused'].includes(item.status)) {
      return ok(this.getSnapshot());
    }

    Object.assign(item, {
      status: 'pending' as const,
      progress: undefined,
      error: undefined,
      logPath: undefined,
      outputPath: undefined,
      updatedAt: now()
    });
    this.emitQueueProgress(item.id, undefined, undefined, true);
    await this.flushPersistAndBroadcast();
    return ok(this.getSnapshot());
  }

  reorder(request: QueueReorderRequest): IpcResult<QueueSnapshot> {
    const index = this.items.findIndex((item) => item.id === request.itemId);
    if (index < 0 || this.items[index].status !== 'pending') {
      return fail('VALIDATION_ERROR', 'Only pending queue items can be reordered.');
    }

    const nextIndex = request.direction === 'up' ? index - 1 : index + 1;
    if (
      nextIndex < 0 ||
      nextIndex >= this.items.length ||
      this.items[nextIndex].status !== 'pending'
    ) {
      return ok(this.getSnapshot());
    }

    const nextItems = [...this.items];
    const [item] = nextItems.splice(index, 1);
    nextItems.splice(nextIndex, 0, item);
    this.items = nextItems;
    this.schedulePersistAndBroadcast();
    return ok(this.getSnapshot());
  }

  move(request: QueueMoveRequest): IpcResult<QueueSnapshot> {
    const movedItems = movePendingItem(this.items, request.itemId, request.targetIndex);
    if (!movedItems) {
      return fail(
        'VALIDATION_ERROR',
        'Only pending queue items can be moved within pending items.'
      );
    }

    this.items = movedItems;
    this.schedulePersistAndBroadcast();
    return ok(this.getSnapshot());
  }

  moveMany(request: QueueMoveManyRequest): IpcResult<QueueSnapshot> {
    const movedItems = movePendingItems(this.items, request.itemIds, request.targetIndex);
    if (!movedItems) {
      return fail(
        'VALIDATION_ERROR',
        'Only pending queue items can be moved within pending items.'
      );
    }

    this.items = movedItems;
    this.schedulePersistAndBroadcast();
    return ok(this.getSnapshot());
  }

  updateExportSettings(request: QueueExportSettingsUpdateRequest): IpcResult<QueueSnapshot> {
    const item = this.items.find((candidate) => candidate.id === request.itemId);
    if (!item) {
      return fail('NOT_FOUND', 'Queue item not found.');
    }

    if (!['pending', 'paused', 'failed', 'cancelled'].includes(item.status)) {
      return fail('VALIDATION_ERROR', 'Export settings can only be edited before retrying.');
    }

    item.exportSettings = mergeExportSettings(request.exportSettings);
    item.requestedOutputPath = item.exportSettings.savePath;
    item.updatedAt = now();
    this.schedulePersistAndBroadcast();
    return ok(this.getSnapshot());
  }

  clear(): IpcResult<QueueSnapshot> {
    this.items = this.items.filter((item) => item.status === 'active');
    this.schedulePersistAndBroadcast();
    return ok(this.getSnapshot());
  }

  async dispose(): Promise<void> {
    await this.persistence.flushPendingOnDispose();
  }

  private async startNext(): Promise<void> {
    if (this.running || this.paused) {
      return;
    }

    const item = this.items.find((candidate) => candidate.status === 'pending');
    const sender = this.activeWebContents;
    if (!item || !sender || sender.isDestroyed()) {
      return;
    }

    this.running = true;
    this.pauseRequested = false;
    this.cancelRequested = false;
    this.skipRequested = false;

    item.status = 'active';
    item.progress = undefined;
    item.error = undefined;
    item.updatedAt = now();
    const historyEntry = this.historyService.addStarted({ ...item, status: 'active' });
    item.historyEntryId = historyEntry.id;
    item.updatedAt = now();
    this.schedulePersistAndBroadcast();

    const decorateProgress = (progress: DownloadProgress): DownloadProgress => {
      const currentIndex = this.items.findIndex((candidate) => candidate.id === item.id);
      return {
        ...progress,
        queuedItemId: item.id,
        queueIndex: currentIndex >= 0 ? currentIndex + 1 : undefined,
        queueTotal: this.items.length
      };
    };

    const result = await this.downloadService.start(
      sender,
      {
        metadata: item.metadata,
        exportSettings: item.exportSettings,
        settings: item.settings,
        outputPath: item.requestedOutputPath
      },
      {
        decorateProgress,
        onProgress: (progress) => this.handleProgress(item.id, progress)
      }
    );

    const resultLogPath = result.ok ? result.data.logPath : result.error.details;

    if (this.pauseRequested) {
      item.status = 'paused';
      item.progress = undefined;
      item.logPath = resultLogPath;
      item.updatedAt = now();
      this.emitQueueProgress(item.id, undefined, resultLogPath, true);
      await this.historyService.update(historyEntry.id, 'cancelled', {
        error: 'Paused.',
        logPath: resultLogPath
      });
      await this.flushPersistAndBroadcast();
    } else if (this.cancelRequested) {
      item.status = 'cancelled';
      item.progress = undefined;
      item.logPath = resultLogPath;
      item.updatedAt = now();
      this.emitQueueProgress(item.id, undefined, resultLogPath, true);
      await this.historyService.update(historyEntry.id, 'cancelled', {
        error: 'Cancelled.',
        logPath: resultLogPath
      });
      this.pruneTerminalItems();
      await this.flushPersistAndBroadcast();
    } else if (this.skipRequested) {
      this.emitQueueProgress(item.id, undefined, resultLogPath, true);
      await this.historyService.update(historyEntry.id, 'cancelled', {
        error: 'Cancelled.',
        logPath: resultLogPath
      });
      this.items = this.items.filter((candidate) => candidate.id !== item.id);
      await this.flushPersistAndBroadcast();
    } else if (result.ok) {
      item.status = 'completed';
      item.progress = undefined;
      item.outputPath = result.data.outputPath;
      item.logPath = result.data.logPath;
      item.updatedAt = now();
      this.emitQueueProgress(item.id, undefined, result.data.logPath, true);
      await this.historyService.update(historyEntry.id, 'completed', {
        outputPath: result.data.outputPath,
        logPath: result.data.logPath
      });
      this.pruneTerminalItems();
      await this.flushPersistAndBroadcast();
    } else {
      const status = result.error.code === 'CANCELLED' ? 'cancelled' : 'failed';
      item.status = status;
      item.progress = undefined;
      item.error = result.error.message;
      item.logPath = result.error.details;
      item.updatedAt = now();
      this.emitQueueProgress(item.id, undefined, result.error.details, true);
      await this.historyService.update(historyEntry.id, status, {
        error: result.error.message,
        logPath: result.error.details
      });
      if (status === 'cancelled') {
        this.pruneTerminalItems();
      }
      await this.flushPersistAndBroadcast();
    }

    this.running = false;
    this.pauseRequested = false;
    this.cancelRequested = false;
    this.skipRequested = false;

    if (!this.paused) {
      void this.startNext();
    }
  }

  private handleProgress(itemId: string, progress: DownloadProgress): void {
    const item = this.items.find((candidate) => candidate.id === itemId);
    if (!item) {
      return;
    }

    item.progress = progress;
    item.logPath = progress.logPath ?? item.logPath;
    item.updatedAt = now();
    this.emitQueueProgress(item.id, progress, item.logPath, false);
  }

  private getActiveItem(): QueueItem | undefined {
    return this.items.find((item) => item.status === 'active');
  }

  private pruneTerminalItems(): void {
    this.items = this.items.filter(
      (item) => item.status !== 'completed' && item.status !== 'cancelled'
    );
  }

  private emitQueueProgress(
    itemId: string,
    progress: DownloadProgress | undefined,
    logPath: string | undefined,
    cleared: boolean
  ): void {
    const event: QueueProgressEvent = {
      itemId,
      progress,
      logPath,
      updatedAt: now(),
      cleared
    };

    for (const contents of webContents.getAllWebContents()) {
      if (!contents.isDestroyed()) {
        contents.send(IPC_CHANNELS.queue.progress, event);
      }
    }
  }

  private resolveRequestedOutputPath(request: QueueAddRequest): string | undefined {
    return request.outputPath ?? request.exportSettings.savePath;
  }

  private schedulePersistAndBroadcast(): void {
    this.persistence.scheduleWrite();
    this.broadcastSnapshot();
  }

  private async flushPersistAndBroadcast(): Promise<void> {
    this.broadcastSnapshot();
    await this.persistence.flushNow();
  }

  private broadcastSnapshot(): void {
    const snapshot = this.getSnapshot();
    for (const contents of webContents.getAllWebContents()) {
      if (!contents.isDestroyed()) {
        contents.send(IPC_CHANNELS.queue.snapshot, snapshot);
      }
    }
  }
}
