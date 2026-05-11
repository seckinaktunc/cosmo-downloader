import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings, IpcResult, VideoMetadata } from '@shared/types';
import { VideoMetadataCoordinator } from '@main/services/videoMetadataCoordinator';
import type { VideoMetadataService } from '@main/services/videoMetadataService';

const send = vi.hoisted(() => vi.fn());
let clipboardText = '';

vi.mock('electron', () => ({
  app: {
    getPath: () => ''
  },
  clipboard: {
    readText: () => clipboardText
  },
  webContents: {
    getAllWebContents: () => [
      {
        isDestroyed: () => false,
        send
      }
    ]
  }
}));

const settings: AppSettings = {
  hardwareAcceleration: true,
  automaticUpdates: true,
  alwaysAskDownloadLocation: false,
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
    downloads: true,
    metadata: true,
    updates: true
  }
};

function metadata(requestId: string, url = 'https://example.com/video'): VideoMetadata {
  return {
    requestId,
    url,
    title: 'Video',
    containers: [],
    videoCodecs: [],
    audioCodecs: [],
    fpsOptions: [],
    formats: []
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

const tempDirs: string[] = [];

function createTempDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'cosmo-prefetch-'));
  tempDirs.push(directory);
  return directory;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const directory = tempDirs.pop();
    if (directory) {
      rmSync(directory, { recursive: true, force: true });
    }
  }
  send.mockReset();
  clipboardText = '';
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('VideoMetadataCoordinator', () => {
  it('prefetches copied URLs and serves a later visible fetch from cache', async () => {
    const fetchMock = vi.fn(
      async (requestId: string, url: string): Promise<IpcResult<VideoMetadata>> => ({
        ok: true,
        data: metadata(requestId, url)
      })
    );
    const cancelMock = vi.fn();
    const coordinator = new VideoMetadataCoordinator(
      { fetch: fetchMock, cancel: cancelMock } as unknown as VideoMetadataService,
      () => settings,
      createTempDirectory()
    );

    coordinator.startClipboardWatcher();
    clipboardText = 'watch https://example.com/video now';
    await vi.advanceTimersByTimeAsync(1100);
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const response = await coordinator.fetch({
      requestId: 'visible-request',
      url: 'https://example.com/video',
      settings
    });

    expect(response.source).toBe('prefetch_cache');
    expect(response.result.ok).toBe(true);
    if (!response.result.ok) {
      throw new Error('Expected cached metadata result.');
    }

    expect(response.result.data.requestId).toBe('visible-request');
    expect(response.result.data.url).toBe('https://example.com/video');
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it('attaches a visible fetch to an in-flight hidden prefetch', async () => {
    const hiddenResult = deferred<IpcResult<VideoMetadata>>();
    const fetchMock = vi.fn((_requestId: string, url: string) =>
      hiddenResult.promise.then(
        (result) =>
          ({
            ...result,
            data: result.ok ? metadata(_requestId, url) : undefined
          }) as IpcResult<VideoMetadata>
      )
    );
    const coordinator = new VideoMetadataCoordinator(
      { fetch: fetchMock, cancel: vi.fn() } as unknown as VideoMetadataService,
      () => settings,
      createTempDirectory()
    );

    coordinator.startClipboardWatcher();
    clipboardText = 'https://example.com/video';
    await vi.advanceTimersByTimeAsync(1100);
    await Promise.resolve();

    const responsePromise = coordinator.fetch({
      requestId: 'visible-request',
      url: 'https://example.com/video',
      settings
    });

    let settled = false;
    void responsePromise.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    hiddenResult.resolve({ ok: true, data: metadata('hidden-request') });
    const response = await responsePromise;

    expect(response.source).toBe('prefetch_attach');
    expect(response.result.ok).toBe(true);
    if (!response.result.ok) {
      throw new Error('Expected attached metadata result.');
    }

    expect(response.result.data.requestId).toBe('visible-request');
  });

  it('detaches a visible request without cancelling the hidden prefetch', async () => {
    const hiddenResult = deferred<IpcResult<VideoMetadata>>();
    const cancelMock = vi.fn();
    const fetchMock = vi.fn(async (_requestId: string, url: string) => {
      const result = await hiddenResult.promise;
      return result.ok ? { ok: true, data: metadata(_requestId, url) } : result;
    });
    const coordinator = new VideoMetadataCoordinator(
      { fetch: fetchMock, cancel: cancelMock } as unknown as VideoMetadataService,
      () => settings,
      createTempDirectory()
    );

    coordinator.startClipboardWatcher();
    clipboardText = 'https://example.com/video';
    await vi.advanceTimersByTimeAsync(1100);
    await Promise.resolve();

    const responsePromise = coordinator.fetch({
      requestId: 'visible-request',
      url: 'https://example.com/video',
      settings
    });
    await Promise.resolve();

    coordinator.cancel('visible-request');
    expect(cancelMock).not.toHaveBeenCalled();

    hiddenResult.resolve({ ok: true, data: metadata('hidden-request') });
    await responsePromise;
  });

  it('clears pure hidden in-flight cache entries by cancelling them', async () => {
    const hiddenResult = deferred<IpcResult<VideoMetadata>>();
    const cancelMock = vi.fn();
    const fetchMock = vi.fn(async (_requestId: string, url: string) => {
      const result = await hiddenResult.promise;
      return result.ok ? { ok: true, data: metadata(_requestId, url) } : result;
    });
    const coordinator = new VideoMetadataCoordinator(
      { fetch: fetchMock, cancel: cancelMock } as unknown as VideoMetadataService,
      () => settings,
      createTempDirectory()
    );

    coordinator.startClipboardWatcher();
    clipboardText = 'https://example.com/video';
    await vi.advanceTimersByTimeAsync(1100);
    await Promise.resolve();

    coordinator.clearCacheEntries();

    expect(cancelMock).toHaveBeenCalledTimes(1);
    expect(coordinator.hasClearableCacheEntries()).toBe(false);
    hiddenResult.resolve({ ok: false, error: { code: 'CANCELLED', message: 'Cancelled' } });
  });

  it('reports retained size for settled metadata cache entries and clears them', async () => {
    const fetchMock = vi.fn(
      async (requestId: string, url: string): Promise<IpcResult<VideoMetadata>> => ({
        ok: true,
        data: {
          ...metadata(requestId, url),
          description: 'prefetched metadata payload'
        }
      })
    );
    const coordinator = new VideoMetadataCoordinator(
      { fetch: fetchMock, cancel: vi.fn() } as unknown as VideoMetadataService,
      () => settings,
      createTempDirectory()
    );

    coordinator.startClipboardWatcher();
    clipboardText = 'https://example.com/video';
    await vi.advanceTimersByTimeAsync(1100);
    await Promise.resolve();

    expect(coordinator.hasClearableCacheEntries()).toBe(true);
    expect(coordinator.getClearableCacheSizeBytes()).toBeGreaterThan(0);

    coordinator.clearCacheEntries();

    expect(coordinator.hasClearableCacheEntries()).toBe(false);
    expect(coordinator.getClearableCacheSizeBytes()).toBe(0);
  });
});
