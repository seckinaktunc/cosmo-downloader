import { app, clipboard, shell, type WebContents, webContents } from 'electron';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { join } from 'path';
import type {
  DownloadHistoryEntry,
  DownloadProgress,
  HistoryChangedEvent,
  HistoryListRequest,
  HistoryListResult,
  DownloadHistoryStatus,
  ExportSettings,
  IpcResult,
  QueueItem,
  RecordFetchHistoryRequest
} from '../../shared/types';
import { IPC_CHANNELS } from '../../shared/ipc';
import { mergeExportSettings } from '../../shared/defaults';
import { canStartHistoryDirectDownload, isHistoryEntryEditable } from '../../shared/historyEntryCapabilities';
import { BufferedJsonFile, loadJsonFileState } from '../utils/jsonFileState';
import { fail, ok } from '../utils/ipcResult';
import type { DownloadService } from './downloadService';

const HISTORY_FILE = 'history.json';

const HISTORY_STATUSES = new Set<DownloadHistoryEntry['status']>([
  'fetched',
  'fetch_failed',
  'started',
  'completed',
  'failed',
  'cancelled'
]);

type LoadedHistoryEntries = {
  entries: DownloadHistoryEntry[];
  needsRewrite: boolean;
};

function now(): string {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

function deserializeEntries(value: unknown): LoadedHistoryEntries {
  if (!Array.isArray(value)) {
    return { entries: [], needsRewrite: true };
  }

  let needsRewrite = false;
  const entries: DownloadHistoryEntry[] = [];

  for (const entry of value) {
    if (!(isRecord(entry) && typeof entry.id === 'string' && isRecord(entry.metadata))) {
      needsRewrite = true;
      continue;
    }

    const exportSettings = mergeExportSettings(entry.exportSettings);
    if (JSON.stringify(exportSettings) !== JSON.stringify(entry.exportSettings ?? null)) {
      needsRewrite = true;
    }

    if (!HISTORY_STATUSES.has(entry.status as DownloadHistoryEntry['status'])) {
      needsRewrite = true;
    }

    entries.push({
      id: entry.id,
      queueItemId: typeof entry.queueItemId === 'string' ? entry.queueItemId : undefined,
      metadata: entry.metadata as DownloadHistoryEntry['metadata'],
      exportSettings,
      settings: entry.settings as DownloadHistoryEntry['settings'],
      status: HISTORY_STATUSES.has(entry.status as DownloadHistoryEntry['status'])
        ? (entry.status as DownloadHistoryEntry['status'])
        : 'completed',
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : now(),
      updatedAt:
        typeof entry.updatedAt === 'string'
          ? entry.updatedAt
          : typeof entry.createdAt === 'string'
            ? entry.createdAt
            : now(),
      outputPath: typeof entry.outputPath === 'string' ? entry.outputPath : undefined,
      logPath: typeof entry.logPath === 'string' ? entry.logPath : undefined,
      error: typeof entry.error === 'string' ? entry.error : undefined
    });
  }

  return { entries, needsRewrite };
}

function loadEntries(filePath: string): ReturnType<typeof loadJsonFileState<LoadedHistoryEntries>> {
  return loadJsonFileState(filePath, {
    createFallback: () => ({ entries: [], needsRewrite: false }),
    deserialize: deserializeEntries
  });
}

export class HistoryService {
  private entries: DownloadHistoryEntry[];
  private readonly persistence: BufferedJsonFile<DownloadHistoryEntry[]>;

  constructor(
    private readonly filePath: string = join(app.getPath('userData'), HISTORY_FILE),
    private readonly getHistoryLimitItems: () => number = () => Number.POSITIVE_INFINITY
  ) {
    const loaded = loadEntries(filePath);
    this.entries = loaded.value.entries;
    this.persistence = new BufferedJsonFile(this.filePath, {
      getValue: () => this.entries
    });

    if (loaded.needsRewrite || loaded.wasMissing || loaded.value.needsRewrite) {
      void this.persistence.flushNow();
    }
  }

  get(): DownloadHistoryEntry[] {
    return [...this.entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  list(request: HistoryListRequest): HistoryListResult {
    const offset = Math.max(0, Math.trunc(request.offset));
    const limit = Math.max(0, Math.trunc(request.limit));
    const entries = this.get();

    return {
      entries: entries.slice(offset, offset + limit),
      totalCount: entries.length
    };
  }

  addStarted(item: QueueItem): DownloadHistoryEntry {
    if (item.historyEntryId) {
      const reusableEntry = this.entries.find(
        (entry) => entry.id === item.historyEntryId && entry.status === 'fetched'
      );
      if (reusableEntry) {
        Object.assign(reusableEntry, {
          queueItemId: item.id,
          metadata: item.metadata,
          exportSettings: mergeExportSettings(item.exportSettings),
          settings: item.settings,
          status: 'started' as const,
          outputPath: undefined,
          logPath: undefined,
          error: undefined,
          updatedAt: now()
        });
        this.writeTrimmedAndBroadcast();
        return reusableEntry;
      }
    }

    const timestamp = now();
    const entry: DownloadHistoryEntry = {
      id: randomUUID(),
      queueItemId: item.id,
      metadata: item.metadata,
      exportSettings: mergeExportSettings(item.exportSettings),
      settings: item.settings,
      status: 'started',
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.entries = [entry, ...this.entries];
    this.writeTrimmedAndBroadcast();
    return entry;
  }

  recordFetch(request: RecordFetchHistoryRequest): DownloadHistoryEntry {
    const timestamp = now();
    const entry: DownloadHistoryEntry = {
      id: randomUUID(),
      metadata: request.metadata,
      exportSettings: mergeExportSettings(request.exportSettings),
      settings: request.settings,
      status: request.status,
      createdAt: timestamp,
      updatedAt: timestamp,
      logPath: request.logPath,
      error: request.error
    };

    this.entries = [entry, ...this.entries];
    this.writeTrimmedAndBroadcast();
    return entry;
  }

  async updateExportSettings(
    entryId: string,
    exportSettings: ExportSettings
  ): Promise<IpcResult<DownloadHistoryEntry>> {
    const entry = this.entries.find((candidate) => candidate.id === entryId);
    if (!entry) {
      return fail('NOT_FOUND', 'History entry not found.');
    }

    if (!isHistoryEntryEditable(entry.status)) {
      return fail(
        'VALIDATION_ERROR',
        'Export settings can only be edited for fetched, failed, or cancelled history entries.'
      );
    }

    entry.exportSettings = mergeExportSettings(exportSettings);
    entry.updatedAt = now();
    await this.flushAndBroadcast();
    return ok(entry);
  }

  async update(
    entryId: string,
    status: DownloadHistoryStatus,
    update: Partial<Pick<DownloadHistoryEntry, 'outputPath' | 'logPath' | 'error'>>
  ): Promise<DownloadHistoryEntry | undefined> {
    const entry = this.entries.find((candidate) => candidate.id === entryId);
    if (!entry) {
      return undefined;
    }

    Object.assign(entry, update, { status, updatedAt: now() });
    await this.flushAndBroadcast();
    return entry;
  }

  async startDownload(
    sender: WebContents,
    downloadService: Pick<DownloadService, 'isActive' | 'start'>,
    entryId: string
  ): Promise<IpcResult<DownloadProgress>> {
    const entry = this.entries.find((candidate) => candidate.id === entryId);
    if (!entry) {
      return fail('NOT_FOUND', 'History entry not found.');
    }

    if (!canStartHistoryDirectDownload(entry.status)) {
      return fail(
        'VALIDATION_ERROR',
        'Only fetched, failed, or cancelled history entries can be downloaded directly.'
      );
    }

    if (downloadService.isActive()) {
      return fail('BUSY', 'A download is already running.');
    }

    this.promoteToStarted(entry);
    await this.flushAndBroadcast();

    let recordedLogPath: string | undefined;
    const result = await downloadService.start(
      sender,
      {
        metadata: entry.metadata,
        exportSettings: entry.exportSettings,
        settings: entry.settings,
        outputPath: entry.exportSettings.savePath
      },
      {
        onProgress: (progress) => {
          if (recordedLogPath || !progress.logPath) {
            return;
          }

          recordedLogPath = progress.logPath;
          void this.attachLogPath(entry.id, progress.logPath);
        }
      }
    );

    if (result.ok) {
      await this.update(entry.id, 'completed', {
        outputPath: result.data.outputPath,
        logPath: result.data.logPath
      });
      return result;
    }

    const status = result.error.code === 'CANCELLED' ? 'cancelled' : 'failed';
    await this.update(entry.id, status, {
      error: result.error.message,
      logPath: result.error.details
    });
    return result;
  }

  remove(entryId: string): void {
    this.entries = this.entries.filter((entry) => entry.id !== entryId);
    this.writeAndBroadcast();
  }

  removeMany(entryIds: string[]): void {
    const selectedIds = new Set(entryIds);
    this.entries = this.entries.filter((entry) => !selectedIds.has(entry.id));
    this.writeAndBroadcast();
  }

  clear(): void {
    this.entries = [];
    this.writeAndBroadcast();
  }

  find(entryId: string): DownloadHistoryEntry | undefined {
    return this.entries.find((entry) => entry.id === entryId);
  }

  findReusableFetchedByRequestId(requestId: string): DownloadHistoryEntry | undefined {
    return this.entries.find(
      (entry) => entry.status === 'fetched' && entry.metadata.requestId === requestId
    );
  }

  openOutput(entryId: string): boolean {
    const outputPath = this.find(entryId)?.outputPath;
    if (!outputPath || !existsSync(outputPath)) {
      return false;
    }

    shell.showItemInFolder(outputPath);
    return true;
  }

  async openMedia(entryId: string): Promise<boolean> {
    const outputPath = this.find(entryId)?.outputPath;
    if (!outputPath || !existsSync(outputPath)) {
      return false;
    }

    const error = await shell.openPath(outputPath);
    return error.length === 0;
  }

  async openFolder(entryId: string): Promise<boolean> {
    const outputPath = this.find(entryId)?.outputPath;
    if (!outputPath || !existsSync(outputPath)) {
      return false;
    }

    shell.showItemInFolder(outputPath);
    return true;
  }

  copySource(entryId: string): boolean {
    const url = this.find(entryId)?.metadata.webpageUrl ?? this.find(entryId)?.metadata.url;
    if (!url) {
      return false;
    }

    clipboard.writeText(url);
    return true;
  }

  enforceLimit(): boolean {
    const trimmed = this.trimToLimit();
    if (trimmed) {
      this.writeAndBroadcast();
    }

    return trimmed;
  }

  async dispose(): Promise<void> {
    await this.persistence.flushPendingOnDispose();
  }

  private trimToLimit(): boolean {
    const limit = Math.max(0, Math.trunc(this.getHistoryLimitItems()));
    if (!Number.isFinite(limit) || limit < 0) {
      return false;
    }

    const sortedEntries = this.get();
    if (sortedEntries.length <= limit) {
      return false;
    }

    this.entries = sortedEntries.slice(0, limit);
    return true;
  }

  private promoteToStarted(entry: DownloadHistoryEntry): void {
    Object.assign(entry, {
      queueItemId: undefined,
      status: 'started' as const,
      outputPath: undefined,
      logPath: undefined,
      error: undefined,
      updatedAt: now()
    });
  }

  private async attachLogPath(entryId: string, logPath: string): Promise<void> {
    const entry = this.entries.find((candidate) => candidate.id === entryId);
    if (!entry || entry.logPath === logPath) {
      return;
    }

    entry.logPath = logPath;
    entry.updatedAt = now();
    await this.flushAndBroadcast();
  }

  private writeTrimmedAndBroadcast(): void {
    this.trimToLimit();
    this.writeAndBroadcast();
  }

  private writeAndBroadcast(): void {
    this.persistence.scheduleWrite();
    this.broadcast();
  }

  private async flushAndBroadcast(): Promise<void> {
    this.broadcast();
    await this.persistence.flushNow();
  }

  private broadcast(): void {
    const event: HistoryChangedEvent = { totalCount: this.entries.length };
    for (const contents of webContents.getAllWebContents()) {
      if (!contents.isDestroyed()) {
        contents.send(IPC_CHANNELS.history.changed, event);
      }
    }
  }
}
