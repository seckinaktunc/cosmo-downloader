import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { WebContents } from 'electron';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_EXPORT_SETTINGS } from '@shared/defaults';
import { IPC_CHANNELS } from '@shared/ipc';
import type {
  AppSettings,
  DownloadProgress,
  ExportSettings,
  QueueItem,
  VideoMetadata
} from '@shared/types';
import type { DownloadService } from '@main/services/downloadService';
import type { HistoryService } from '@main/services/historyService';
import { QueueService } from '@main/services/queueService';

const { mockQueueWebContents } = vi.hoisted(() => ({
  mockQueueWebContents: [] as Array<{ isDestroyed: () => boolean; send: ReturnType<typeof vi.fn> }>
}));

vi.mock('electron', () => ({
  app: {
    getPath: () => ''
  },
  dialog: {
    showSaveDialog: vi.fn()
  },
  webContents: {
    getAllWebContents: () => mockQueueWebContents
  }
}));

const { dialog } = await import('electron');
const tempDirs: string[] = [];
const services: QueueService[] = [];

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

function createQueueService(): QueueService {
  const directory = mkdtempSync(join(tmpdir(), 'cosmo-queue-'));
  tempDirs.push(directory);
  const service = new QueueService(
    {} as DownloadService,
    {} as HistoryService,
    join(directory, 'queue.json')
  );
  services.push(service);
  return service;
}

function queueItem(id: string, status: QueueItem['status']): QueueItem {
  return {
    id,
    metadata: metadata(id),
    exportSettings: DEFAULT_EXPORT_SETTINGS,
    settings,
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

afterEach(async () => {
  await Promise.allSettled(services.splice(0).map((service) => service.dispose()));
  mockQueueWebContents.length = 0;
  while (tempDirs.length > 0) {
    const directory = tempDirs.pop();
    if (directory) {
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

describe('QueueService export settings updates', () => {
  it('merges missing video bitrate and trim settings into persisted queue items', () => {
    const directory = mkdtempSync(join(tmpdir(), 'cosmo-queue-'));
    tempDirs.push(directory);
    const filePath = join(directory, 'queue.json');
    writeFileSync(
      filePath,
      JSON.stringify([
        {
          id: 'legacy',
          metadata: metadata('legacy'),
          exportSettings: {
            outputFormat: 'mp4',
            resolution: 'auto',
            audioBitrate: 'auto',
            frameRate: 'auto',
            videoCodec: 'auto',
            audioCodec: 'auto'
          },
          settings,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]),
      'utf8'
    );

    const service = new QueueService({} as DownloadService, {} as HistoryService, filePath);
    services.push(service);

    expect(service.getSnapshot().items[0].exportSettings.videoBitrate).toBe('auto');
    expect(service.getSnapshot().items[0].exportSettings.trimStartSeconds).toBe(0);
    expect(service.getSnapshot().items[0].exportSettings.trimEndSeconds).toBeUndefined();
  });

  it('prunes completed and cancelled persisted queue items', () => {
    const directory = mkdtempSync(join(tmpdir(), 'cosmo-queue-'));
    tempDirs.push(directory);
    const filePath = join(directory, 'queue.json');
    writeFileSync(
      filePath,
      JSON.stringify([
        queueItem('pending', 'pending'),
        queueItem('completed', 'completed'),
        queueItem('cancelled', 'cancelled')
      ]),
      'utf8'
    );

    const service = new QueueService({} as DownloadService, {} as HistoryService, filePath);
    services.push(service);

    expect(service.getSnapshot().items.map((item) => item.id)).toEqual(['pending']);
  });

  it('updates export settings for pending queue items', async () => {
    const service = createQueueService();
    const addResult = await service.add({
      metadata: metadata('one'),
      exportSettings: DEFAULT_EXPORT_SETTINGS,
      settings
    });
    if (!addResult.ok) throw new Error(addResult.error.message);
    const itemId = addResult.data.items[0].id;
    const nextSettings: ExportSettings = { ...DEFAULT_EXPORT_SETTINGS, outputFormat: 'mkv' };

    const result = service.updateExportSettings({ itemId, exportSettings: nextSettings });

    expect(result.ok).toBe(true);
    expect(service.getSnapshot().items[0].exportSettings).toEqual(nextSettings);
  });

  it('does not persist or broadcast full snapshots on live progress updates', async () => {
    let emitProgress: ((progress: DownloadProgress) => void) | undefined;
    let resolveDownload: ((value: { ok: true; data: DownloadProgress }) => void) | undefined;
    const downloadService = {
      start: vi.fn().mockImplementation(
        async (
          _sender,
          _request,
          options?: { onProgress?: (progress: DownloadProgress) => void }
        ) =>
          new Promise((resolve) => {
            emitProgress = options?.onProgress;
            resolveDownload = resolve;
          })
      ),
      cancel: vi.fn()
    } as unknown as DownloadService;
    const historyService = {
      addStarted: vi.fn((item: QueueItem) => ({
        id: `${item.id}-history`,
        queueItemId: item.id,
        metadata: item.metadata,
        exportSettings: item.exportSettings,
        settings: item.settings,
        status: 'started',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })),
      update: vi.fn()
    } as unknown as HistoryService;
    const directory = mkdtempSync(join(tmpdir(), 'cosmo-queue-'));
    tempDirs.push(directory);
    const filePath = join(directory, 'queue.json');
    const broadcastTarget = { isDestroyed: () => false, send: vi.fn() };
    mockQueueWebContents.push(broadcastTarget);
    const service = new QueueService(downloadService, historyService, filePath);
    services.push(service);
    const addResult = await service.add({
      metadata: metadata('one'),
      exportSettings: DEFAULT_EXPORT_SETTINGS,
      settings
    });
    if (!addResult.ok) throw new Error(addResult.error.message);

    service.start({ isDestroyed: () => false } as WebContents);

    await vi.waitFor(() => {
      expect(service.getSnapshot().activeItemId).toBe(addResult.data.items[0].id);
    });
    await service.dispose();
    const queueFileBeforeProgress = readFileSync(filePath, 'utf8');
    broadcastTarget.send.mockClear();

    emitProgress?.({
      stage: 'downloading',
      stageLabel: 'Downloading',
      percentage: 42,
      logPath: '/logs/one.log'
    });

    await service.dispose();
    const queueFileAfterProgress = readFileSync(filePath, 'utf8');

    expect(queueFileAfterProgress).toBe(queueFileBeforeProgress);
    expect(
      broadcastTarget.send.mock.calls.some(([channel]) => channel === IPC_CHANNELS.queue.snapshot)
    ).toBe(false);
    expect(
      broadcastTarget.send.mock.calls.some(([channel, event]) => {
        return (
          channel === IPC_CHANNELS.queue.progress &&
          event.itemId === addResult.data.items[0].id &&
          event.progress?.percentage === 42 &&
          event.cleared === false
        );
      })
    ).toBe(true);

    resolveDownload?.({
      ok: true,
      data: {
        stage: 'completed',
        stageLabel: 'Completed',
        percentage: 100,
        outputPath: '/downloads/video.mp4',
        logPath: '/logs/video.log'
      }
    });
  });

  it('does not prompt when a queue item is added without a save path', async () => {
    vi.mocked(dialog.showSaveDialog).mockClear();
    const service = createQueueService();

    const addResult = await service.add({
      metadata: metadata('one'),
      exportSettings: DEFAULT_EXPORT_SETTINGS,
      settings
    });

    if (!addResult.ok) throw new Error(addResult.error.message);
    expect(addResult.data.items[0].requestedOutputPath).toBeUndefined();
    expect(vi.mocked(dialog.showSaveDialog)).not.toHaveBeenCalled();
  });

  it('reuses fetched history entries for matching preview request ids', async () => {
    const historyService = {
      findReusableFetchedByRequestId: vi.fn().mockReturnValue({ id: 'history-entry' })
    } as unknown as HistoryService;
    const directory = mkdtempSync(join(tmpdir(), 'cosmo-queue-'));
    tempDirs.push(directory);
    const service = new QueueService(
      {} as DownloadService,
      historyService,
      join(directory, 'queue.json')
    );
    services.push(service);

    const addResult = await service.add({
      metadata: metadata('matching-request'),
      exportSettings: DEFAULT_EXPORT_SETTINGS,
      settings
    });
    if (!addResult.ok) throw new Error(addResult.error.message);

    expect(addResult.data.items[0]?.historyEntryId).toBe('history-entry');
    expect(historyService.findReusableFetchedByRequestId).toHaveBeenCalledWith('matching-request');
  });

  it('rejects export settings updates for active queue items', async () => {
    let resolveDownload: ((value: { ok: true; data: DownloadProgress }) => void) | undefined;
    const downloadService = {
      start: vi.fn().mockImplementation(
        async () =>
          new Promise((resolve) => {
            resolveDownload = resolve;
          })
      ),
      cancel: vi.fn()
    } as unknown as DownloadService;
    const historyService = {
      addStarted: vi.fn((item: QueueItem) => ({
        id: `${item.id}-history`,
        queueItemId: item.id,
        metadata: item.metadata,
        exportSettings: item.exportSettings,
        settings: item.settings,
        status: 'started',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })),
      update: vi.fn()
    } as unknown as HistoryService;
    const directory = mkdtempSync(join(tmpdir(), 'cosmo-queue-'));
    tempDirs.push(directory);
    const service = new QueueService(
      downloadService,
      historyService,
      join(directory, 'queue.json')
    );
    services.push(service);
    const addResult = await service.add({
      metadata: metadata('one'),
      exportSettings: DEFAULT_EXPORT_SETTINGS,
      settings
    });
    if (!addResult.ok) throw new Error(addResult.error.message);
    const itemId = addResult.data.items[0].id;
    service.start({ isDestroyed: () => false } as WebContents);

    await vi.waitFor(() => {
      expect(service.getSnapshot().activeItemId).toBe(itemId);
    });

    const result = service.updateExportSettings({
      itemId,
      exportSettings: { ...DEFAULT_EXPORT_SETTINGS, outputFormat: 'webm' }
    });

    expect(result.ok).toBe(false);

    resolveDownload?.({
      ok: true,
      data: {
        stage: 'completed',
        stageLabel: 'Completed',
        percentage: 100,
        outputPath: '/downloads/video.mp4',
        logPath: '/logs/video.log'
      }
    });
  });

  it('prunes completed queue items after history is updated', async () => {
    const completedProgress: DownloadProgress = {
      stage: 'completed',
      stageLabel: 'Completed',
      percentage: 100,
      outputPath: '/downloads/video.mp4',
      logPath: '/logs/video.log'
    };
    const downloadService = {
      start: vi.fn().mockResolvedValue({ ok: true, data: completedProgress }),
      cancel: vi.fn()
    } as unknown as DownloadService;
    const historyService = {
      addStarted: vi.fn((item: QueueItem) => ({
        id: 'history-entry',
        queueItemId: item.id,
        metadata: item.metadata,
        exportSettings: item.exportSettings,
        settings: item.settings,
        status: 'started',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })),
      update: vi.fn()
    } as unknown as HistoryService;
    const directory = mkdtempSync(join(tmpdir(), 'cosmo-queue-'));
    tempDirs.push(directory);
    const service = new QueueService(
      downloadService,
      historyService,
      join(directory, 'queue.json')
    );
    services.push(service);
    const addResult = await service.add({
      metadata: metadata('one'),
      exportSettings: DEFAULT_EXPORT_SETTINGS,
      settings
    });
    if (!addResult.ok) throw new Error(addResult.error.message);

    service.start({ isDestroyed: () => false } as WebContents);

    await vi.waitFor(() => {
      expect(service.getSnapshot().items).toEqual([]);
    });
    expect(historyService.update).toHaveBeenCalledWith('history-entry', 'completed', {
      outputPath: '/downloads/video.mp4',
      logPath: '/logs/video.log'
    });
  });

  it('emits cleared queue progress when a download fails', async () => {
    let emitProgress: ((progress: DownloadProgress) => void) | undefined;
    let resolveDownload:
      | ((value: {
          ok: false;
          error: { code: 'PROCESS_FAILED'; message: string; details: string };
        }) => void)
      | undefined;
    const downloadService = {
      start: vi.fn().mockImplementation(
        async (
          _sender,
          _request,
          options?: { onProgress?: (progress: DownloadProgress) => void }
        ) =>
          new Promise((resolve) => {
            emitProgress = options?.onProgress;
            resolveDownload = resolve;
          })
      ),
      cancel: vi.fn()
    } as unknown as DownloadService;
    const historyService = {
      addStarted: vi.fn((item: QueueItem) => ({
        id: `${item.id}-history`,
        queueItemId: item.id,
        metadata: item.metadata,
        exportSettings: item.exportSettings,
        settings: item.settings,
        status: 'started',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })),
      update: vi.fn()
    } as unknown as HistoryService;
    const directory = mkdtempSync(join(tmpdir(), 'cosmo-queue-'));
    tempDirs.push(directory);
    const broadcastTarget = { isDestroyed: () => false, send: vi.fn() };
    mockQueueWebContents.push(broadcastTarget);
    const service = new QueueService(
      downloadService,
      historyService,
      join(directory, 'queue.json')
    );
    services.push(service);
    const addResult = await service.add({
      metadata: metadata('one'),
      exportSettings: DEFAULT_EXPORT_SETTINGS,
      settings
    });
    if (!addResult.ok) throw new Error(addResult.error.message);

    service.start({ isDestroyed: () => false } as WebContents);
    await vi.waitFor(() => {
      expect(service.getSnapshot().activeItemId).toBe(addResult.data.items[0].id);
    });

    emitProgress?.({
      stage: 'downloading',
      stageLabel: 'Downloading',
      percentage: 12,
      logPath: '/logs/one.log'
    });
    broadcastTarget.send.mockClear();

    resolveDownload?.({
      ok: false,
      error: {
        code: 'PROCESS_FAILED',
        message: 'ffmpeg failed',
        details: '/logs/one.log'
      }
    });

    await vi.waitFor(() => {
      expect(service.getSnapshot().items[0]?.status).toBe('failed');
    });

    expect(service.getSnapshot().items[0]?.progress).toBeUndefined();
    expect(
      broadcastTarget.send.mock.calls.some(([channel, event]) => {
        return (
          channel === IPC_CHANNELS.queue.progress &&
          event.itemId === addResult.data.items[0].id &&
          event.cleared === true &&
          event.logPath === '/logs/one.log'
        );
      })
    ).toBe(true);
  });

  it('emits cleared queue progress when a download is paused', async () => {
    let emitProgress: ((progress: DownloadProgress) => void) | undefined;
    let resolveDownload:
      | ((value: {
          ok: false;
          error: { code: 'CANCELLED'; message: string; details: string };
        }) => void)
      | undefined;
    const downloadService = {
      start: vi.fn().mockImplementation(
        async (
          _sender,
          _request,
          options?: { onProgress?: (progress: DownloadProgress) => void }
        ) =>
          new Promise((resolve) => {
            emitProgress = options?.onProgress;
            resolveDownload = resolve;
          })
      ),
      cancel: vi.fn()
    } as unknown as DownloadService;
    const historyService = {
      addStarted: vi.fn((item: QueueItem) => ({
        id: `${item.id}-history`,
        queueItemId: item.id,
        metadata: item.metadata,
        exportSettings: item.exportSettings,
        settings: item.settings,
        status: 'started',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })),
      update: vi.fn()
    } as unknown as HistoryService;
    const directory = mkdtempSync(join(tmpdir(), 'cosmo-queue-'));
    tempDirs.push(directory);
    const broadcastTarget = { isDestroyed: () => false, send: vi.fn() };
    mockQueueWebContents.push(broadcastTarget);
    const service = new QueueService(
      downloadService,
      historyService,
      join(directory, 'queue.json')
    );
    services.push(service);
    const addResult = await service.add({
      metadata: metadata('one'),
      exportSettings: DEFAULT_EXPORT_SETTINGS,
      settings
    });
    if (!addResult.ok) throw new Error(addResult.error.message);

    service.start({ isDestroyed: () => false } as WebContents);
    await vi.waitFor(() => {
      expect(service.getSnapshot().activeItemId).toBe(addResult.data.items[0].id);
    });

    emitProgress?.({
      stage: 'downloading',
      stageLabel: 'Downloading',
      percentage: 55,
      logPath: '/logs/one.log'
    });
    service.pause();
    broadcastTarget.send.mockClear();

    resolveDownload?.({
      ok: false,
      error: {
        code: 'CANCELLED',
        message: 'Cancelled by user.',
        details: '/logs/one.log'
      }
    });

    await vi.waitFor(() => {
      expect(service.getSnapshot().items[0]?.status).toBe('paused');
    });

    expect(service.getSnapshot().items[0]?.progress).toBeUndefined();
    expect(
      broadcastTarget.send.mock.calls.some(([channel, event]) => {
        return (
          channel === IPC_CHANNELS.queue.progress &&
          event.itemId === addResult.data.items[0].id &&
          event.cleared === true &&
          event.logPath === '/logs/one.log'
        );
      })
    ).toBe(true);
  });

  it('skips the active item, preserves cancelled history, and continues to the next item', async () => {
    const completedProgress: DownloadProgress = {
      stage: 'completed',
      stageLabel: 'Completed',
      percentage: 100,
      outputPath: '/downloads/two.mp4',
      logPath: '/logs/two.log'
    };
    let resolveFirstDownload:
      | ((value: {
          ok: false;
          error: { code: 'CANCELLED'; message: string; details: string };
        }) => void)
      | undefined;
    const downloadService = {
      start: vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveFirstDownload = resolve;
            })
        )
        .mockResolvedValueOnce({ ok: true, data: completedProgress }),
      cancel: vi.fn()
    } as unknown as DownloadService;
    const historyService = {
      addStarted: vi.fn((item: QueueItem) => ({
        id: `${item.id}-history`,
        queueItemId: item.id,
        metadata: item.metadata,
        exportSettings: item.exportSettings,
        settings: item.settings,
        status: 'started',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })),
      update: vi.fn()
    } as unknown as HistoryService;
    const directory = mkdtempSync(join(tmpdir(), 'cosmo-queue-'));
    tempDirs.push(directory);
    const service = new QueueService(
      downloadService,
      historyService,
      join(directory, 'queue.json')
    );
    services.push(service);
    const firstAddResult = await service.add({
      metadata: metadata('one'),
      exportSettings: DEFAULT_EXPORT_SETTINGS,
      settings
    });
    if (!firstAddResult.ok) throw new Error(firstAddResult.error.message);
    const secondAddResult = await service.add({
      metadata: metadata('two'),
      exportSettings: DEFAULT_EXPORT_SETTINGS,
      settings
    });
    if (!secondAddResult.ok) throw new Error(secondAddResult.error.message);
    const firstItemId = firstAddResult.data.items[0].id;
    const secondItemId = secondAddResult.data.items[1].id;

    service.start({ isDestroyed: () => false } as WebContents);

    await vi.waitFor(() => {
      expect(service.getSnapshot().activeItemId).toBe(firstItemId);
    });

    const skipResult = service.skipActive();
    expect(skipResult.ok).toBe(true);
    expect(downloadService.cancel).toHaveBeenCalledTimes(1);

    resolveFirstDownload?.({
      ok: false,
      error: {
        code: 'CANCELLED',
        message: 'Cancelled by user.',
        details: '/logs/one.log'
      }
    });

    await vi.waitFor(() => {
      expect(downloadService.start).toHaveBeenCalledTimes(2);
    });
    await vi.waitFor(() => {
      expect(service.getSnapshot().items).toEqual([]);
    });
    expect(historyService.update).toHaveBeenCalledWith(`${firstItemId}-history`, 'cancelled', {
      error: 'Cancelled.',
      logPath: '/logs/one.log'
    });
    expect(historyService.update).toHaveBeenCalledWith(`${secondItemId}-history`, 'completed', {
      outputPath: '/downloads/two.mp4',
      logPath: '/logs/two.log'
    });
  });

  it('skips the only active item and leaves the queue empty', async () => {
    let resolveDownload:
      | ((value: {
          ok: false;
          error: { code: 'CANCELLED'; message: string; details: string };
        }) => void)
      | undefined;
    const downloadService = {
      start: vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveDownload = resolve;
          })
      ),
      cancel: vi.fn()
    } as unknown as DownloadService;
    const historyService = {
      addStarted: vi.fn((item: QueueItem) => ({
        id: `${item.id}-history`,
        queueItemId: item.id,
        metadata: item.metadata,
        exportSettings: item.exportSettings,
        settings: item.settings,
        status: 'started',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })),
      update: vi.fn()
    } as unknown as HistoryService;
    const directory = mkdtempSync(join(tmpdir(), 'cosmo-queue-'));
    tempDirs.push(directory);
    const service = new QueueService(
      downloadService,
      historyService,
      join(directory, 'queue.json')
    );
    services.push(service);
    const addResult = await service.add({
      metadata: metadata('one'),
      exportSettings: DEFAULT_EXPORT_SETTINGS,
      settings
    });
    if (!addResult.ok) throw new Error(addResult.error.message);
    const itemId = addResult.data.items[0].id;

    service.start({ isDestroyed: () => false } as WebContents);

    await vi.waitFor(() => {
      expect(service.getSnapshot().activeItemId).toBe(itemId);
    });

    service.skipActive();
    expect(downloadService.cancel).toHaveBeenCalledTimes(1);

    resolveDownload?.({
      ok: false,
      error: {
        code: 'CANCELLED',
        message: 'Cancelled by user.',
        details: '/logs/one.log'
      }
    });

    await vi.waitFor(() => {
      expect(service.getSnapshot().items).toEqual([]);
    });
    expect(service.getSnapshot().paused).toBe(false);
    expect(historyService.update).toHaveBeenCalledWith(`${itemId}-history`, 'cancelled', {
      error: 'Cancelled.',
      logPath: '/logs/one.log'
    });
  });

  it('keeps remaining items pending when cancelActive is used', async () => {
    let resolveFirstDownload:
      | ((value: {
          ok: false;
          error: { code: 'CANCELLED'; message: string; details: string };
        }) => void)
      | undefined;
    const downloadService = {
      start: vi.fn().mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstDownload = resolve;
          })
      ),
      cancel: vi.fn()
    } as unknown as DownloadService;
    const historyService = {
      addStarted: vi.fn((item: QueueItem) => ({
        id: `${item.id}-history`,
        queueItemId: item.id,
        metadata: item.metadata,
        exportSettings: item.exportSettings,
        settings: item.settings,
        status: 'started',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })),
      update: vi.fn()
    } as unknown as HistoryService;
    const directory = mkdtempSync(join(tmpdir(), 'cosmo-queue-'));
    tempDirs.push(directory);
    const service = new QueueService(
      downloadService,
      historyService,
      join(directory, 'queue.json')
    );
    services.push(service);
    const firstAddResult = await service.add({
      metadata: metadata('one'),
      exportSettings: DEFAULT_EXPORT_SETTINGS,
      settings
    });
    if (!firstAddResult.ok) throw new Error(firstAddResult.error.message);
    const secondAddResult = await service.add({
      metadata: metadata('two'),
      exportSettings: DEFAULT_EXPORT_SETTINGS,
      settings
    });
    if (!secondAddResult.ok) throw new Error(secondAddResult.error.message);
    const firstItemId = firstAddResult.data.items[0].id;
    const secondItemId = secondAddResult.data.items[1].id;

    service.start({ isDestroyed: () => false } as WebContents);

    await vi.waitFor(() => {
      expect(service.getSnapshot().activeItemId).toBe(firstItemId);
    });

    const cancelResult = service.cancelActive();
    expect(cancelResult.ok).toBe(true);
    expect(downloadService.cancel).toHaveBeenCalledTimes(1);

    resolveFirstDownload?.({
      ok: false,
      error: {
        code: 'CANCELLED',
        message: 'Cancelled by user.',
        details: '/logs/one.log'
      }
    });

    await vi.waitFor(() => {
      expect(service.getSnapshot().items.map((item) => item.id)).toEqual([secondItemId]);
    });
    expect(service.getSnapshot().items[0].status).toBe('pending');
    expect(service.getSnapshot().paused).toBe(true);
    expect(downloadService.start).toHaveBeenCalledTimes(1);
    expect(historyService.update).toHaveBeenCalledWith(`${firstItemId}-history`, 'cancelled', {
      error: 'Cancelled.',
      logPath: '/logs/one.log'
    });
  });
});
