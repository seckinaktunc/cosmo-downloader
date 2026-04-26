import { app, dialog, webContents, type WebContents } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
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
  QueueReorderRequest,
  QueueSnapshot
} from '../../shared/types';
import { createUniquePath } from './filename';
import { DownloadService } from './downloadService';
import { HistoryService } from './historyService';
import { movePendingItem, movePendingItems, removeManyQueueItems } from '../../shared/queueModel';
import { fail, ok } from '../utils/ipcResult';

const QUEUE_FILE = 'queue.json';

function now(): string {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

function readItems(filePath: string): QueueItem[] {
  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is QueueItem => {
        return isRecord(item) && typeof item.id === 'string' && isRecord(item.metadata);
      })
      .map((item) => ({
        ...item,
        exportSettings: mergeExportSettings(item.exportSettings),
        ...(item.status === 'active'
          ? { status: 'paused' as const, updatedAt: now(), progress: undefined }
          : {})
      }))
      .filter((item) => item.status !== 'completed' && item.status !== 'cancelled');
  } catch {
    return [];
  }
}

export class QueueService {
  private items: QueueItem[];
  private paused = true;
  private running = false;
  private pauseRequested = false;
  private cancelRequested = false;
  private activeWebContents: WebContents | null = null;

  constructor(
    private readonly downloadService: DownloadService,
    private readonly historyService: HistoryService,
    private readonly filePath: string = join(app.getPath('userData'), QUEUE_FILE)
  ) {
    this.items = readItems(filePath);
    this.write();
  }

  getSnapshot(): QueueSnapshot {
    return {
      items: this.items,
      activeItemId: this.items.find((item) => item.status === 'active')?.id,
      paused: this.paused
    };
  }

  hasActiveItem(): boolean {
    return this.items.some((item) => item.status === 'active') || this.running;
  }

  async add(request: QueueAddRequest): Promise<IpcResult<QueueSnapshot>> {
    const requestedOutputPath = await this.resolveRequestedOutputPath(request);
    if (requestedOutputPath === null) {
      return fail('CANCELLED', 'Queue item was not added.');
    }

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
    this.writeAndBroadcast();
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
    this.writeAndBroadcast();
    return ok(this.getSnapshot());
  }

  start(webContents: WebContents): IpcResult<QueueSnapshot> {
    this.activeWebContents = webContents;
    this.paused = false;
    void this.startNext();
    this.writeAndBroadcast();
    return ok(this.getSnapshot());
  }

  resume(webContents: WebContents): IpcResult<QueueSnapshot> {
    this.activeWebContents = webContents;
    this.paused = false;
    this.items = this.items.map((item) =>
      item.status === 'paused' ? { ...item, status: 'pending', updatedAt: now() } : item
    );
    void this.startNext();
    this.writeAndBroadcast();
    return ok(this.getSnapshot());
  }

  pause(): IpcResult<QueueSnapshot> {
    this.paused = true;
    const active = this.getActiveItem();
    if (active) {
      this.pauseRequested = true;
      this.downloadService.cancel();
    }
    this.writeAndBroadcast();
    return ok(this.getSnapshot());
  }

  cancelActive(): IpcResult<QueueSnapshot> {
    this.paused = true;
    const active = this.getActiveItem();
    if (active) {
      this.cancelRequested = true;
      this.downloadService.cancel();
    }
    this.writeAndBroadcast();
    return ok(this.getSnapshot());
  }

  remove(itemId: string): IpcResult<QueueSnapshot> {
    const item = this.items.find((candidate) => candidate.id === itemId);
    if (item?.status === 'active') {
      return fail('BUSY', 'The active queue item cannot be removed.');
    }

    this.items = this.items.filter((candidate) => candidate.id !== itemId);
    this.writeAndBroadcast();
    return ok(this.getSnapshot());
  }

  removeMany(request: QueueBulkRequest): IpcResult<QueueSnapshot> {
    this.items = removeManyQueueItems(this.items, request.itemIds);
    this.writeAndBroadcast();
    return ok(this.getSnapshot());
  }

  retry(itemId: string): IpcResult<QueueSnapshot> {
    this.items = this.items.map((item) =>
      item.id === itemId && ['failed', 'cancelled', 'paused'].includes(item.status)
        ? {
            ...item,
            status: 'pending',
            progress: undefined,
            error: undefined,
            logPath: undefined,
            outputPath: undefined,
            updatedAt: now()
          }
        : item
    );
    this.writeAndBroadcast();
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
    this.writeAndBroadcast();
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
    this.writeAndBroadcast();
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
    this.writeAndBroadcast();
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
    this.writeAndBroadcast();
    return ok(this.getSnapshot());
  }

  clear(): IpcResult<QueueSnapshot> {
    this.items = this.items.filter((item) => item.status === 'active');
    this.writeAndBroadcast();
    return ok(this.getSnapshot());
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
    this.updateItem(item.id, { status: 'active', progress: undefined, error: undefined });
    const historyEntry = this.historyService.addStarted({ ...item, status: 'active' });
    this.updateItem(item.id, { historyEntryId: historyEntry.id });

    if (this.pauseRequested || this.cancelRequested) {
      if (this.pauseRequested) {
        this.updateItem(item.id, { status: 'paused', progress: undefined, updatedAt: now() });
        this.historyService.update(historyEntry.id, 'cancelled', { error: 'Paused.' });
      } else {
        this.updateItem(
          item.id,
          { status: 'cancelled', progress: undefined, updatedAt: now() },
          false
        );
        this.historyService.update(historyEntry.id, 'cancelled', { error: 'Cancelled.' });
        this.pruneTerminalItems();
      }

      this.running = false;
      this.pauseRequested = false;
      this.cancelRequested = false;
      this.writeAndBroadcast();
      return;
    }

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
      this.updateItem(item.id, {
        status: 'paused',
        progress: undefined,
        logPath: resultLogPath,
        updatedAt: now()
      });
      this.historyService.update(historyEntry.id, 'cancelled', {
        error: 'Paused.',
        logPath: resultLogPath
      });
    } else if (this.cancelRequested) {
      this.updateItem(
        item.id,
        {
          status: 'cancelled',
          logPath: resultLogPath,
          progress: result.ok ? result.data : undefined
        },
        false
      );
      this.historyService.update(historyEntry.id, 'cancelled', {
        error: 'Cancelled.',
        logPath: resultLogPath
      });
      this.pruneTerminalItems();
    } else if (result.ok) {
      this.updateItem(
        item.id,
        {
          status: 'completed',
          outputPath: result.data.outputPath,
          logPath: result.data.logPath,
          progress: result.data
        },
        false
      );
      this.historyService.update(historyEntry.id, 'completed', {
        outputPath: result.data.outputPath,
        logPath: result.data.logPath
      });
      this.pruneTerminalItems();
    } else {
      const status = result.error.code === 'CANCELLED' ? 'cancelled' : 'failed';
      this.updateItem(
        item.id,
        {
          status,
          error: result.error.message,
          logPath: result.error.details,
          progress: undefined
        },
        status !== 'cancelled'
      );
      this.historyService.update(historyEntry.id, status, {
        error: result.error.message,
        logPath: result.error.details
      });
      if (status === 'cancelled') {
        this.pruneTerminalItems();
      }
    }

    this.running = false;
    this.pauseRequested = false;
    this.cancelRequested = false;
    this.writeAndBroadcast();

    if (!this.paused) {
      void this.startNext();
    }
  }

  private handleProgress(itemId: string, progress: DownloadProgress): void {
    this.updateItem(itemId, { progress, logPath: progress.logPath, updatedAt: now() }, false);
    this.writeAndBroadcast();
  }

  private getActiveItem(): QueueItem | undefined {
    return this.items.find((item) => item.status === 'active');
  }

  private pruneTerminalItems(): void {
    this.items = this.items.filter(
      (item) => item.status !== 'completed' && item.status !== 'cancelled'
    );
  }

  private updateItem(
    itemId: string,
    update: Partial<QueueItem>,
    broadcast = true
  ): QueueItem | undefined {
    const item = this.items.find((candidate) => candidate.id === itemId);
    if (!item) {
      return undefined;
    }

    Object.assign(item, update, { updatedAt: now() });
    if (broadcast) {
      this.writeAndBroadcast();
    }
    return item;
  }

  private async resolveRequestedOutputPath(
    request: QueueAddRequest
  ): Promise<string | undefined | null> {
    const explicitOutputPath = request.outputPath ?? request.exportSettings.savePath;
    if (explicitOutputPath || !request.settings.alwaysAskDownloadLocation) {
      return explicitOutputPath;
    }

    const extension = request.exportSettings.outputFormat;
    const result = await dialog.showSaveDialog({
      title: 'Save queued download',
      defaultPath: createUniquePath(
        request.settings.lastDownloadDirectory ||
          request.settings.defaultDownloadLocation ||
          app.getPath('downloads'),
        request.metadata.title,
        extension
      ),
      filters: [{ name: extension.toUpperCase(), extensions: [extension] }]
    });

    return result.canceled || !result.filePath ? null : result.filePath;
  }

  private writeAndBroadcast(): void {
    this.write();
    this.broadcast();
  }

  private broadcast(): void {
    const snapshot = this.getSnapshot();
    for (const contents of webContents.getAllWebContents()) {
      if (!contents.isDestroyed()) {
        contents.send(IPC_CHANNELS.queue.snapshot, snapshot);
      }
    }
  }

  private write(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, `${JSON.stringify(this.items, null, 2)}\n`, 'utf8');
  }
}
