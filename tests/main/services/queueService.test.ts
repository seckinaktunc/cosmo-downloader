import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { WebContents } from 'electron';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_EXPORT_SETTINGS } from '@shared/defaults';
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

vi.mock('electron', () => ({
  app: {
    getPath: () => ''
  },
  dialog: {
    showSaveDialog: vi.fn()
  },
  webContents: {
    getAllWebContents: () => []
  }
}));

const tempDirs: string[] = [];

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

function createQueueService(): QueueService {
  const directory = mkdtempSync(join(tmpdir(), 'cosmo-queue-'));
  tempDirs.push(directory);
  return new QueueService(
    {} as DownloadService,
    {} as HistoryService,
    join(directory, 'queue.json')
  );
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

afterEach(() => {
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

    const addResult = await service.add({
      metadata: metadata('matching-request'),
      exportSettings: DEFAULT_EXPORT_SETTINGS,
      settings
    });
    if (!addResult.ok) throw new Error(addResult.error.message);

    expect(addResult.data.items[0]?.historyEntryId).toBe('history-entry');
    expect(historyService.findReusableFetchedByRequestId).toHaveBeenCalledWith('matching-request');
  });

  it('rejects export settings updates for completed queue items', async () => {
    const service = createQueueService();
    const addResult = await service.add({
      metadata: metadata('one'),
      exportSettings: DEFAULT_EXPORT_SETTINGS,
      settings
    });
    if (!addResult.ok) throw new Error(addResult.error.message);
    const itemId = addResult.data.items[0].id;
    service.getSnapshot().items[0].status = 'completed';

    const result = service.updateExportSettings({
      itemId,
      exportSettings: { ...DEFAULT_EXPORT_SETTINGS, outputFormat: 'webm' }
    });

    expect(result.ok).toBe(false);
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
