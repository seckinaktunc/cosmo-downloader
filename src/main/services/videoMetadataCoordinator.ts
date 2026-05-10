import { app, clipboard, webContents } from 'electron';
import { randomUUID } from 'crypto';
import { existsSync, rmSync, statSync } from 'fs';
import { join } from 'path';
import { IPC_CHANNELS } from '../../shared/ipc';
import { classifyVideoUrl, extractFirstValidUrlFromText, validateUrl } from '../../shared/url';
import type {
  AppSettings,
  FetchMetadataResponse,
  IpcError,
  IpcResult,
  MetadataFetchLifecycleEvent,
  VideoMetadata
} from '../../shared/types';
import type { CacheBudgetCoordinator } from './cacheBudgetCoordinator';
import { VideoMetadataService } from './videoMetadataService';

type SharedFetchOperation = {
  id: string;
  cacheKey: string;
  normalizedUrl: string;
  settings: AppSettings;
  visibleRequestIds: Set<string>;
  hiddenOwner: boolean;
  visibleAdopted: boolean;
  logOwnedByCache: boolean;
  logPath: string;
  promise: Promise<IpcResult<VideoMetadata>>;
};

type InflightCacheEntry = {
  state: 'inflight';
  operation: SharedFetchOperation;
};

type SettledCacheEntry = {
  state: 'succeeded' | 'failed';
  normalizedUrl: string;
  result: IpcResult<VideoMetadata>;
  logPath?: string;
  logOwnedByCache: boolean;
};

type CacheEntry = InflightCacheEntry | SettledCacheEntry;

type PreparedUrl =
  | { ok: true; normalizedUrl: string; cacheKey: string; localFailure?: IpcError }
  | { ok: false; error: IpcError };

function now(): string {
  return new Date().toISOString();
}

function broadcast(channel: string, payload: unknown): void {
  for (const contents of webContents.getAllWebContents()) {
    if (!contents.isDestroyed()) {
      contents.send(channel, payload);
    }
  }
}

function createCacheKey(
  normalizedUrl: string,
  settings: Pick<AppSettings, 'cookiesBrowser'>
): string {
  return `${normalizedUrl}\u001f${settings.cookiesBrowser}`;
}

function cloneMetadataForRequestId(metadata: VideoMetadata, requestId: string): VideoMetadata {
  return { ...metadata, requestId };
}

function cloneResultForRequestId(
  result: IpcResult<VideoMetadata>,
  requestId: string
): IpcResult<VideoMetadata> {
  if (!result.ok) {
    return {
      ok: false,
      error: {
        ...result.error
      }
    };
  }

  return {
    ok: true,
    data: cloneMetadataForRequestId(result.data, requestId)
  };
}

function getFileSize(filePath: string | undefined): number {
  if (!filePath || !existsSync(filePath)) {
    return 0;
  }

  try {
    return statSync(filePath).size;
  } catch {
    return 0;
  }
}

function removeFile(filePath: string | undefined): void {
  if (!filePath || !existsSync(filePath)) {
    return;
  }

  try {
    rmSync(filePath, { force: true });
  } catch {
    // Best effort cleanup.
  }
}

function getSerializedResultSize(result: IpcResult<VideoMetadata>): number {
  return Buffer.byteLength(JSON.stringify(result), 'utf8');
}

function toLifecycleState(result: IpcResult<VideoMetadata>): MetadataFetchLifecycleEvent['state'] {
  if (result.ok) {
    return 'succeeded';
  }

  return result.error.code === 'CANCELLED' ? 'cancelled' : 'failed';
}

export class VideoMetadataCoordinator {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly visibleRequestToOperation = new Map<string, string>();
  private readonly operations = new Map<string, SharedFetchOperation>();
  private clipboardPollTimer: NodeJS.Timeout | null = null;
  private clipboardDebounceTimer: NodeJS.Timeout | null = null;
  private lastClipboardText = '';
  private pendingClipboardUrl: string | null = null;
  private activeHiddenOperationId: string | null = null;

  constructor(
    private readonly metadataService: VideoMetadataService,
    private readonly getSettings: () => AppSettings,
    private readonly logsDirectory: string = join(app.getPath('userData'), 'logs'),
    private readonly clipboardPollMs: number = 500,
    private readonly prefetchDebounceMs: number = 600,
    private readonly cacheBudgetCoordinator?: CacheBudgetCoordinator
  ) {}

  startClipboardWatcher(): void {
    if (this.clipboardPollTimer) {
      return;
    }

    this.lastClipboardText = clipboard.readText();
    this.clipboardPollTimer = setInterval(() => {
      const currentClipboardText = clipboard.readText();
      if (currentClipboardText === this.lastClipboardText) {
        return;
      }

      this.lastClipboardText = currentClipboardText;
      this.onClipboardTextChanged(currentClipboardText);
    }, this.clipboardPollMs);
  }

  cancel(requestId: string): void {
    const operationId = this.visibleRequestToOperation.get(requestId);
    if (!operationId) {
      this.metadataService.cancel(requestId);
      return;
    }

    this.visibleRequestToOperation.delete(requestId);
    const operation = this.operations.get(operationId);
    if (!operation) {
      this.metadataService.cancel(operationId);
      return;
    }

    operation.visibleRequestIds.delete(requestId);
    if (requestId !== operation.id) {
      this.emitLifecycle(requestId, operation.normalizedUrl, operation.logPath, 'cancelled');
    }

    if (operation.visibleRequestIds.size === 0 && !operation.hiddenOwner) {
      this.metadataService.cancel(operation.id);
    }
  }

  async fetch(request: {
    requestId: string;
    url: string;
    settings: AppSettings;
    forceRefresh?: boolean;
  }): Promise<FetchMetadataResponse> {
    const prepared = this.prepareUrl(request.url, request.settings);
    if (!prepared.ok) {
      return {
        requestId: request.requestId,
        source: 'fresh',
        result: {
          ok: false,
          error: prepared.error
        }
      };
    }

    return this.fetchPrepared(
      request.requestId,
      prepared.normalizedUrl,
      request.settings,
      prepared.cacheKey,
      prepared.localFailure,
      Boolean(request.forceRefresh)
    );
  }

  hasClearableCacheEntries(): boolean {
    for (const entry of this.cache.values()) {
      if (entry.state === 'inflight') {
        if (entry.operation.hiddenOwner && !entry.operation.visibleAdopted) {
          return true;
        }
        continue;
      }

      return true;
    }

    return false;
  }

  getClearableCacheSizeBytes(): number {
    let sizeBytes = 0;

    for (const entry of this.cache.values()) {
      if (entry.state === 'inflight') {
        if (entry.operation.hiddenOwner && !entry.operation.visibleAdopted) {
          sizeBytes += getFileSize(entry.operation.logPath);
        }
        continue;
      }

      sizeBytes += this.getSettledEntrySize(entry);
    }

    return sizeBytes;
  }

  clearCacheEntries(): void {
    if (this.clipboardDebounceTimer) {
      clearTimeout(this.clipboardDebounceTimer);
      this.clipboardDebounceTimer = null;
    }
    this.pendingClipboardUrl = null;

    for (const [cacheKey, entry] of Array.from(this.cache.entries())) {
      if (entry.state === 'inflight') {
        if (entry.operation.hiddenOwner && !entry.operation.visibleAdopted) {
          this.metadataService.cancel(entry.operation.id);
          if (entry.operation.logOwnedByCache) {
            removeFile(entry.operation.logPath);
          }
          this.cache.delete(cacheKey);
          this.operations.delete(entry.operation.id);
          if (this.activeHiddenOperationId === entry.operation.id) {
            this.activeHiddenOperationId = null;
          }
        }
        continue;
      }

      this.deleteSettledCacheEntry(cacheKey, entry);
    }
  }

  dispose(): void {
    if (this.clipboardPollTimer) {
      clearInterval(this.clipboardPollTimer);
      this.clipboardPollTimer = null;
    }

    if (this.clipboardDebounceTimer) {
      clearTimeout(this.clipboardDebounceTimer);
      this.clipboardDebounceTimer = null;
    }

    for (const [cacheKey, entry] of Array.from(this.cache.entries())) {
      if (entry.state === 'inflight') {
        if (entry.operation.hiddenOwner && !entry.operation.visibleAdopted) {
          this.metadataService.cancel(entry.operation.id);
          if (entry.operation.logOwnedByCache) {
            removeFile(entry.operation.logPath);
          }
        }
        this.cache.delete(cacheKey);
        continue;
      }

      this.deleteSettledCacheEntry(cacheKey, entry);
    }

    this.operations.clear();
    this.visibleRequestToOperation.clear();
    this.pendingClipboardUrl = null;
    this.activeHiddenOperationId = null;
  }

  private prepareUrl(inputUrl: string, settings: AppSettings): PreparedUrl {
    const validation = validateUrl(inputUrl);
    if (!validation.isValid || !validation.normalized) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.reason ?? 'Invalid URL.'
        }
      };
    }

    const normalizedUrl = validation.normalized;
    const cacheKey = createCacheKey(normalizedUrl, settings);
    const kind = classifyVideoUrl(normalizedUrl);

    if (kind === 'playlist' || kind === 'channel') {
      return {
        ok: true,
        normalizedUrl,
        cacheKey,
        localFailure: {
          code: 'UNSUPPORTED_URL',
          message: 'Only single-video links are supported in this version.'
        }
      };
    }

    return { ok: true, normalizedUrl, cacheKey };
  }

  private async fetchPrepared(
    requestId: string,
    normalizedUrl: string,
    settings: AppSettings,
    cacheKey: string,
    localFailure: IpcError | undefined,
    forceRefresh: boolean
  ): Promise<FetchMetadataResponse> {
    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return this.consumeCachedEntry(requestId, cacheKey, cached);
      }
    } else {
      const existing = this.cache.get(cacheKey);
      if (existing?.state === 'inflight') {
        if (existing.operation.hiddenOwner && !existing.operation.visibleAdopted) {
          this.metadataService.cancel(existing.operation.id);
          if (existing.operation.logOwnedByCache) {
            removeFile(existing.operation.logPath);
          }
          this.cache.delete(cacheKey);
          this.operations.delete(existing.operation.id);
        } else {
          return this.attachToOperation(requestId, existing.operation);
        }
      } else if (existing) {
        this.deleteSettledCacheEntry(cacheKey, existing);
      }
    }

    if (localFailure) {
      const result: IpcResult<VideoMetadata> = {
        ok: false,
        error: localFailure
      };
      const settledEntry: SettledCacheEntry = {
        state: 'failed',
        normalizedUrl,
        result,
        logOwnedByCache: false
      };
      this.cache.set(cacheKey, settledEntry);
      this.registerSettledCacheEntry(cacheKey, settledEntry);
      return {
        requestId,
        source: 'fresh',
        result
      };
    }

    const operation = this.startOperation(requestId, normalizedUrl, settings, cacheKey, {
      hiddenOwner: false,
      logOwnedByCache: false
    });

    const result = await operation.promise;
    return {
      requestId,
      source: 'fresh',
      logPath: existsSync(operation.logPath) ? operation.logPath : undefined,
      result: cloneResultForRequestId(result, requestId)
    };
  }

  private consumeCachedEntry(
    requestId: string,
    cacheKey: string,
    entry: CacheEntry
  ): Promise<FetchMetadataResponse> | FetchMetadataResponse {
    if (entry.state === 'inflight') {
      return this.attachToOperation(requestId, entry.operation);
    }

    entry.logOwnedByCache = false;
    this.registerSettledCacheEntry(cacheKey, entry);
    return {
      requestId,
      source: 'prefetch_cache',
      logPath: entry.logPath,
      result: cloneResultForRequestId(entry.result, requestId)
    };
  }

  private async attachToOperation(
    requestId: string,
    operation: SharedFetchOperation
  ): Promise<FetchMetadataResponse> {
    operation.visibleRequestIds.add(requestId);
    this.visibleRequestToOperation.set(requestId, operation.id);

    if (operation.hiddenOwner) {
      operation.visibleAdopted = true;
      operation.logOwnedByCache = false;
    }

    this.emitLifecycle(requestId, operation.normalizedUrl, operation.logPath, 'started');
    const result = await operation.promise;

    return {
      requestId,
      source: 'prefetch_attach',
      logPath: existsSync(operation.logPath) ? operation.logPath : undefined,
      result: cloneResultForRequestId(result, requestId)
    };
  }

  private startOperation(
    operationId: string,
    normalizedUrl: string,
    settings: AppSettings,
    cacheKey: string,
    options: {
      hiddenOwner: boolean;
      logOwnedByCache: boolean;
    }
  ): SharedFetchOperation {
    const operation: SharedFetchOperation = {
      id: operationId,
      cacheKey,
      normalizedUrl,
      settings,
      visibleRequestIds: options.hiddenOwner ? new Set<string>() : new Set<string>([operationId]),
      hiddenOwner: options.hiddenOwner,
      visibleAdopted: false,
      logOwnedByCache: options.logOwnedByCache,
      logPath: join(this.logsDirectory, `${operationId}.log`),
      promise: Promise.resolve({ ok: false, error: { code: 'UNKNOWN', message: 'Not started.' } })
    };

    if (!options.hiddenOwner) {
      this.visibleRequestToOperation.set(operationId, operationId);
    }

    this.operations.set(operationId, operation);
    this.cache.set(cacheKey, { state: 'inflight', operation });
    if (options.hiddenOwner) {
      this.activeHiddenOperationId = operationId;
    }

    operation.promise = this.metadataService
      .fetch(operationId, normalizedUrl, settings)
      .then((result) => {
        this.operations.delete(operationId);
        if (this.activeHiddenOperationId === operationId) {
          this.activeHiddenOperationId = null;
        }

        for (const visibleRequestId of Array.from(operation.visibleRequestIds)) {
          if (visibleRequestId !== operationId) {
            const stillAttached =
              this.visibleRequestToOperation.get(visibleRequestId) === operation.id;
            if (stillAttached) {
              this.emitLifecycle(
                visibleRequestId,
                operation.normalizedUrl,
                operation.logPath,
                toLifecycleState(result)
              );
            }
            this.visibleRequestToOperation.delete(visibleRequestId);
          } else if (!operation.hiddenOwner) {
            this.visibleRequestToOperation.delete(visibleRequestId);
          }
        }

        if (!result.ok && result.error.code === 'CANCELLED') {
          if (operation.logOwnedByCache) {
            removeFile(operation.logPath);
          }

          const currentEntry = this.cache.get(cacheKey);
          if (currentEntry?.state === 'inflight' && currentEntry.operation.id === operation.id) {
            this.cache.delete(cacheKey);
          }
          return result;
        }

        const logPath = existsSync(operation.logPath) ? operation.logPath : undefined;
        const settledEntry: SettledCacheEntry = {
          state: result.ok ? 'succeeded' : 'failed',
          normalizedUrl,
          result,
          logPath,
          logOwnedByCache: operation.logOwnedByCache
        };
        this.cache.set(cacheKey, settledEntry);
        this.registerSettledCacheEntry(cacheKey, settledEntry);
        return result;
      });

    return operation;
  }

  private onClipboardTextChanged(text: string): void {
    const settings = this.getSettings();
    if (!settings.clipboardPrefetchEnabled) {
      if (this.clipboardDebounceTimer) {
        clearTimeout(this.clipboardDebounceTimer);
        this.clipboardDebounceTimer = null;
      }
      this.pendingClipboardUrl = null;
      return;
    }

    const candidateUrl = extractFirstValidUrlFromText(text);
    if (!candidateUrl) {
      this.pendingClipboardUrl = null;
      if (this.clipboardDebounceTimer) {
        clearTimeout(this.clipboardDebounceTimer);
        this.clipboardDebounceTimer = null;
      }
      return;
    }

    this.pendingClipboardUrl = candidateUrl;
    if (this.clipboardDebounceTimer) {
      clearTimeout(this.clipboardDebounceTimer);
    }

    this.clipboardDebounceTimer = setTimeout(() => {
      this.clipboardDebounceTimer = null;
      const latestSettings = this.getSettings();
      if (!latestSettings.clipboardPrefetchEnabled || this.pendingClipboardUrl == null) {
        return;
      }

      const pendingUrl = this.pendingClipboardUrl;
      this.pendingClipboardUrl = null;
      void this.prefetchFromClipboard(pendingUrl, latestSettings);
    }, this.prefetchDebounceMs);
  }

  private async prefetchFromClipboard(inputUrl: string, settings: AppSettings): Promise<void> {
    const prepared = this.prepareUrl(inputUrl, settings);
    if (!prepared.ok) {
      return;
    }

    const { cacheKey, normalizedUrl, localFailure } = prepared;
    if (this.cache.has(cacheKey)) {
      return;
    }

    const activeHiddenOperation =
      this.activeHiddenOperationId != null
        ? this.operations.get(this.activeHiddenOperationId)
        : null;
    if (activeHiddenOperation && activeHiddenOperation.cacheKey !== cacheKey) {
      if (activeHiddenOperation.hiddenOwner && !activeHiddenOperation.visibleAdopted) {
        this.metadataService.cancel(activeHiddenOperation.id);
        if (activeHiddenOperation.logOwnedByCache) {
          removeFile(activeHiddenOperation.logPath);
        }
        this.operations.delete(activeHiddenOperation.id);
        this.cache.delete(activeHiddenOperation.cacheKey);
        this.activeHiddenOperationId = null;
      } else {
        return;
      }
    }

    if (localFailure) {
      const settledEntry: SettledCacheEntry = {
        state: 'failed',
        normalizedUrl,
        result: {
          ok: false,
          error: localFailure
        },
        logOwnedByCache: false
      };
      this.cache.set(cacheKey, settledEntry);
      this.registerSettledCacheEntry(cacheKey, settledEntry);
      return;
    }

    const operation = this.startOperation(randomUUID(), normalizedUrl, settings, cacheKey, {
      hiddenOwner: true,
      logOwnedByCache: true
    });
    void operation.promise;
  }

  private emitLifecycle(
    requestId: string,
    url: string,
    logPath: string,
    state: MetadataFetchLifecycleEvent['state']
  ): void {
    const event: MetadataFetchLifecycleEvent = {
      requestId,
      url,
      logPath,
      state,
      timestamp: now()
    };
    broadcast(IPC_CHANNELS.video.fetchLifecycle, event);
  }

  private getCacheBudgetEntryId(cacheKey: string): string {
    return `metadataPrefetch:${cacheKey}`;
  }

  private getSettledEntrySize(entry: SettledCacheEntry): number {
    let sizeBytes = getSerializedResultSize(entry.result);
    if (entry.logOwnedByCache) {
      sizeBytes += getFileSize(entry.logPath);
    }
    return sizeBytes;
  }

  private registerSettledCacheEntry(cacheKey: string, entry: SettledCacheEntry): void {
    this.cacheBudgetCoordinator?.upsertEntry({
      id: this.getCacheBudgetEntryId(cacheKey),
      kind: 'metadataPrefetch',
      sizeBytes: this.getSettledEntrySize(entry),
      evict: () => {
        const currentEntry = this.cache.get(cacheKey);
        if (currentEntry?.state === 'inflight') {
          return;
        }

        if (currentEntry) {
          this.deleteSettledCacheEntry(cacheKey, currentEntry);
        }
      }
    });
  }

  private deleteSettledCacheEntry(cacheKey: string, entry: SettledCacheEntry): void {
    if (entry.logOwnedByCache) {
      removeFile(entry.logPath);
    }
    this.cache.delete(cacheKey);
    this.cacheBudgetCoordinator?.removeEntry(this.getCacheBudgetEntryId(cacheKey));
  }
}
