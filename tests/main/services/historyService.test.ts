import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { shell } from 'electron';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  AppSettings,
  DownloadProgress,
  ExportSettings,
  QueueItem,
  VideoMetadata
} from '@shared/types';
import type { DownloadService } from '@main/services/downloadService';
import { HistoryService } from '@main/services/historyService';

vi.mock('electron', () => ({
  app: {
    getPath: () => ''
  },
  clipboard: {
    writeText: vi.fn()
  },
  shell: {
    showItemInFolder: vi.fn(),
    openPath: vi.fn().mockResolvedValue('')
  },
  webContents: {
    getAllWebContents: () => []
  }
}));

const tempDirs: string[] = [];
const services: HistoryService[] = [];

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

const exportSettings: ExportSettings = {
  outputFormat: 'mp4',
  resolution: 'auto',
  videoBitrate: 'auto',
  audioBitrate: 'auto',
  frameRate: 'auto',
  trimStartSeconds: 0,
  trimEndSeconds: undefined,
  videoCodec: 'auto',
  audioCodec: 'auto'
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

function queueItem(id: string): QueueItem {
  return {
    id,
    metadata: metadata(id),
    exportSettings,
    settings,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function createHistoryService(getLimit: () => number = () => Number.POSITIVE_INFINITY): {
  service: HistoryService;
  filePath: string;
} {
  const directory = mkdtempSync(join(tmpdir(), 'cosmo-history-'));
  tempDirs.push(directory);
  const filePath = join(directory, 'history.json');
  const service = new HistoryService(filePath, getLimit);
  services.push(service);
  return { service, filePath };
}

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.allSettled(services.splice(0).map((service) => service.dispose()));
  while (tempDirs.length > 0) {
    const directory = tempDirs.pop();
    if (directory) {
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

describe('HistoryService', () => {
  it('merges missing video bitrate and trim settings into persisted history entries', () => {
    const directory = mkdtempSync(join(tmpdir(), 'cosmo-history-'));
    tempDirs.push(directory);
    const filePath = join(directory, 'history.json');
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
          status: 'completed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]),
      'utf8'
    );

    const service = new HistoryService(filePath);
    services.push(service);

    expect(service.get()[0].exportSettings.videoBitrate).toBe('auto');
    expect(service.get()[0].exportSettings.trimStartSeconds).toBe(0);
    expect(service.get()[0].exportSettings.trimEndSeconds).toBeUndefined();
  });

  it('returns paged history entries with the total count', () => {
    const { service } = createHistoryService();
    const one = service.addStarted(queueItem('one'));
    const two = service.addStarted(queueItem('two'));
    service.addStarted(queueItem('three'));

    expect(service.list({ offset: 1, limit: 1 })).toEqual({
      entries: [two],
      totalCount: 3
    });
    expect(service.list({ offset: 2, limit: 1 }).entries[0]?.id).toBe(one.id);
  });

  it('removes many selected entries in one update', () => {
    const { service } = createHistoryService();
    const one = service.addStarted(queueItem('one'));
    const two = service.addStarted(queueItem('two'));
    const three = service.addStarted(queueItem('three'));

    service.removeMany([one.id, three.id]);

    expect(service.get().map((entry) => entry.id)).toEqual([two.id]);
  });

  it('ignores missing ids when removing many entries', () => {
    const { service } = createHistoryService();
    const one = service.addStarted(queueItem('one'));

    service.removeMany(['missing']);

    expect(service.get().map((entry) => entry.id)).toEqual([one.id]);
  });

  it('records settled fetches with log paths', () => {
    const { service } = createHistoryService();

    const entry = service.recordFetch({
      metadata: metadata('fetched'),
      exportSettings,
      settings,
      status: 'fetched',
      logPath: '/logs/fetched.log'
    });

    expect(entry.status).toBe('fetched');
    expect(entry.logPath).toBe('/logs/fetched.log');
    expect(service.get()[0]?.id).toBe(entry.id);
  });

  it('updates export settings only for editable history entries', async () => {
    const { service } = createHistoryService();
    const fetchedEntry = service.recordFetch({
      metadata: metadata('fetched'),
      exportSettings,
      settings,
      status: 'fetched',
      logPath: '/logs/fetched.log'
    });
    const completedEntry = service.addStarted(queueItem('completed'));

    const updated = await service.updateExportSettings(fetchedEntry.id, {
      ...exportSettings,
      outputFormat: 'mkv'
    });
    const rejected = await service.updateExportSettings(completedEntry.id, {
      ...exportSettings,
      outputFormat: 'webm'
    });

    expect(updated.ok).toBe(true);
    expect(updated.ok && updated.data.exportSettings.outputFormat).toBe('mkv');
    expect(rejected.ok).toBe(false);
  });

  it('reuses fetched entries when a matching request starts downloading', () => {
    const { service } = createHistoryService();
    const fetchedEntry = service.recordFetch({
      metadata: metadata('fetched'),
      exportSettings,
      settings,
      status: 'fetched',
      logPath: '/logs/fetch.log'
    });

    const queued = {
      ...queueItem('queued'),
      metadata: { ...metadata('fetched'), requestId: 'fetched' },
      historyEntryId: fetchedEntry.id
    };

    const reusedEntry = service.addStarted(queued);

    expect(reusedEntry.id).toBe(fetchedEntry.id);
    expect(reusedEntry.status).toBe('started');
    expect(reusedEntry.queueItemId).toBe('queued');
    expect(reusedEntry.logPath).toBeUndefined();
    expect(service.get()).toHaveLength(1);
  });

  it('reuses the same entry id for direct history downloads and marks it started immediately', async () => {
    let emitProgress: ((progress: DownloadProgress) => void) | undefined;
    let resolveDownload:
      | ((value: { ok: true; data: DownloadProgress }) => void)
      | undefined;
    const downloadService = {
      isActive: vi.fn(() => false),
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
      )
    } as unknown as Pick<DownloadService, 'isActive' | 'start'>;
    const { service } = createHistoryService();
    const entry = service.recordFetch({
      metadata: metadata('direct-history'),
      exportSettings,
      settings,
      status: 'fetched',
      logPath: '/logs/fetched.log'
    });

    const resultPromise = service.startDownload(
      { isDestroyed: () => false } as never,
      downloadService,
      entry.id
    );

    await vi.waitFor(() => {
      expect(service.find(entry.id)?.status).toBe('started');
    });
    await vi.waitFor(() => {
      expect(emitProgress).toBeTypeOf('function');
    });

    emitProgress?.({
      stage: 'downloading',
      stageLabel: 'Downloading',
      percentage: 25,
      logPath: '/logs/direct-history.log'
    });
    await vi.waitFor(() => {
      expect(service.find(entry.id)?.logPath).toBe('/logs/direct-history.log');
    });

    resolveDownload?.({
      ok: true,
      data: {
        stage: 'completed',
        stageLabel: 'Completed',
        percentage: 100,
        outputPath: '/downloads/direct-history.mp4',
        logPath: '/logs/direct-history.log'
      }
    });

    const result = await resultPromise;

    expect(result.ok).toBe(true);
    expect(service.find(entry.id)?.status).toBe('completed');
    expect(service.find(entry.id)?.outputPath).toBe('/downloads/direct-history.mp4');
    expect(service.get()).toHaveLength(1);
  });

  it('rejects direct history downloads for non-startable statuses', async () => {
    const { service } = createHistoryService();
    const entry = service.addStarted(queueItem('completed'));
    await service.update(entry.id, 'completed', { outputPath: '/downloads/completed.mp4' });
    const downloadService = {
      isActive: vi.fn(() => false),
      start: vi.fn()
    } as unknown as Pick<DownloadService, 'isActive' | 'start'>;

    const result = await service.startDownload(
      { isDestroyed: () => false } as never,
      downloadService,
      entry.id
    );

    expect(result.ok).toBe(false);
    expect(downloadService.start).not.toHaveBeenCalled();
  });

  it('trims the oldest entries when the limit is exceeded', () => {
    const historyLimitItems = 2;
    const { service } = createHistoryService(() => historyLimitItems);

    const one = service.addStarted(queueItem('one'));
    const two = service.addStarted(queueItem('two'));
    const three = service.addStarted(queueItem('three'));

    expect(service.get().map((entry) => entry.id)).toEqual([three.id, two.id]);
    expect(service.get().some((entry) => entry.id === one.id)).toBe(false);
  });

  it('trims immediately when the saved limit is lowered and persists the reduced history', async () => {
    let historyLimitItems = 3;
    const { service, filePath } = createHistoryService(() => historyLimitItems);

    service.addStarted(queueItem('one'));
    service.addStarted(queueItem('two'));
    const three = service.addStarted(queueItem('three'));

    historyLimitItems = 1;
    expect(service.enforceLimit()).toBe(true);
    expect(service.get().map((entry) => entry.id)).toEqual([three.id]);
    await service.dispose();

    const reloaded = new HistoryService(filePath);
    services.push(reloaded);
    expect(reloaded.get().map((entry) => entry.id)).toEqual([three.id]);
  });

  it('opens downloaded media with the OS default app', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'cosmo-history-'));
    tempDirs.push(directory);
    const outputPath = join(directory, 'video.mp4');
    writeFileSync(outputPath, 'media');
    const service = new HistoryService(join(directory, 'history.json'));
    services.push(service);
    const entry = service.addStarted(queueItem('one'));
    await service.update(entry.id, 'completed', { outputPath });

    await expect(service.openMedia(entry.id)).resolves.toBe(true);
    expect(vi.mocked(shell.openPath)).toHaveBeenCalledWith(outputPath);
  });

  it('reveals the downloaded media folder', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'cosmo-history-'));
    tempDirs.push(directory);
    const outputPath = join(directory, 'video.mp4');
    writeFileSync(outputPath, 'media');
    const service = new HistoryService(join(directory, 'history.json'));
    services.push(service);
    const entry = service.addStarted(queueItem('one'));
    await service.update(entry.id, 'completed', { outputPath });

    await expect(service.openFolder(entry.id)).resolves.toBe(true);
    expect(vi.mocked(shell.showItemInFolder)).toHaveBeenCalledWith(outputPath);
  });
});
