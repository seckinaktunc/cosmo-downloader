import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings, SettingsUpdate } from '@shared/types';
import type { SettingsService } from '@main/services/settingsService';
import {
  ensureMacUpdateConfigFile,
  getMacUpdateConfigPath,
  getReleasePageUrl,
  UpdateService
} from '@main/services/updateService';

vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    getPath: () => '/tmp/cosmo-user-data'
  },
  webContents: {
    getAllWebContents: () => []
  }
}));

vi.mock('electron-updater', () => ({
  autoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: true,
    allowPrerelease: false,
    logger: null,
    on: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn()
  }
}));

const logError = vi.hoisted(() => vi.fn());
vi.mock('electron-log/main', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: logError
  }
}));

const baseSettings: AppSettings = {
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

class FakeUpdater extends EventEmitter {
  autoDownload = true;
  autoInstallOnAppQuit = false;
  allowPrerelease = true;
  logger: unknown = null;
  updateConfigPath: string | undefined;
  feedUrl = 'https://github.com/seckinaktunc/cosmo-downloader';
  feedConfig: {
    provider: 'generic';
    url: string;
    channel: string;
  } | null = null;
  checkForUpdates = vi.fn(async () => ({}));
  downloadUpdate = vi.fn(async () => []);
  quitAndInstall = vi.fn();
  getFeedURL = vi.fn(() => this.feedUrl);
  setFeedURL = vi.fn((options: { provider: 'generic'; url: string; channel: string }) => {
    this.feedConfig = options;
    this.feedUrl = options.url;
  });
}

function createSettingsService(initial: Partial<AppSettings> = {}): SettingsService {
  let settings = { ...baseSettings, ...initial };
  return {
    get: () => settings,
    update: (update: SettingsUpdate) => {
      settings = { ...settings, ...update };
      return settings;
    }
  } as SettingsService;
}

function createService({
  settings = {},
  updater = new FakeUpdater(),
  isPackaged = true,
  isMediaBusy = false,
  now = new Date('2026-04-19T10:00:00.000Z'),
  platform = 'linux',
  arch = 'x64',
  userDataPath
}: {
  settings?: Partial<AppSettings>;
  updater?: FakeUpdater;
  isPackaged?: boolean;
  isMediaBusy?: boolean;
  now?: Date;
  platform?: NodeJS.Platform;
  arch?: string;
  userDataPath?: string;
} = {}): { service: UpdateService; updater: FakeUpdater; settingsService: SettingsService } {
  const settingsService = createSettingsService(settings);
  const service = new UpdateService(settingsService, {
    updater,
    isPackaged: () => isPackaged,
    isMediaBusy: () => isMediaBusy,
    now: () => now,
    platform,
    arch,
    userDataPath
  });

  return { service, updater, settingsService };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getReleasePageUrl', () => {
  it('builds the GitHub tag URL for a version', () => {
    expect(getReleasePageUrl('1.2.3')).toBe(
      'https://github.com/seckinaktunc/cosmo-downloader/releases/tag/v1.2.3'
    );
  });
});

describe('UpdateService', () => {
  it('writes a mac updater config file that electron-updater can read later', () => {
    const userDataPath = mkdtempSync(join(tmpdir(), 'cosmo-updater-config-'));

    try {
      const configPath = ensureMacUpdateConfigFile(userDataPath, 'arm64');

      expect(configPath).toBe(getMacUpdateConfigPath(userDataPath));
      expect(readFileSync(configPath, 'utf8')).toContain('channel: "latest-arm64"');
      expect(readFileSync(configPath, 'utf8')).toContain(
        'updaterCacheDirName: "cosmo-downloader-updater"'
      );
    } finally {
      rmSync(userDataPath, { recursive: true, force: true });
    }
  });

  it('configures an arch-specific generic feed for packaged arm64 mac builds', () => {
    const updater = new FakeUpdater();
    const userDataPath = mkdtempSync(join(tmpdir(), 'cosmo-updater-service-'));

    createService({
      updater,
      platform: 'darwin',
      arch: 'arm64',
      userDataPath
    });

    try {
      expect(updater.setFeedURL).toHaveBeenCalledWith({
        provider: 'generic',
        url: 'https://github.com/seckinaktunc/cosmo-downloader/releases/latest/download/',
        channel: 'latest-arm64'
      });
      expect(updater.updateConfigPath).toBe(getMacUpdateConfigPath(userDataPath));
    } finally {
      rmSync(userDataPath, { recursive: true, force: true });
    }
  });

  it('configures an arch-specific generic feed for packaged x64 mac builds', () => {
    const updater = new FakeUpdater();
    createService({
      updater,
      platform: 'darwin',
      arch: 'x64'
    });

    expect(updater.setFeedURL).toHaveBeenCalledWith({
      provider: 'generic',
      url: 'https://github.com/seckinaktunc/cosmo-downloader/releases/latest/download/',
      channel: 'latest-x64'
    });
  });

  it('keeps the existing updater provider on non-mac builds', () => {
    const updater = new FakeUpdater();
    createService({
      updater,
      platform: 'linux',
      arch: 'x64'
    });

    expect(updater.setFeedURL).not.toHaveBeenCalled();
  });

  it('guards manual checks in unpackaged builds', async () => {
    const { service, updater } = createService({ isPackaged: false });

    const result = await service.checkNow();

    expect(result.ok).toBe(true);
    expect(service.getState().status).toBe('unavailable');
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
  });

  it('returns early when automaticUpdates is off without invoking the updater', async () => {
    const { service, updater } = createService({ settings: { automaticUpdates: false } });

    await service.checkOnLaunch();

    expect(updater.checkForUpdates).not.toHaveBeenCalled();
  });

  it('runs launch checks regardless of the previous timestamp', async () => {
    const { service, updater } = createService({
      settings: {
        automaticUpdates: true,
        lastAutomaticUpdateCheckAt: '2026-04-19T09:59:59.000Z'
      }
    });

    await service.checkOnLaunch();

    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('lets manual checks bypass any throttle', async () => {
    const { service, updater } = createService({
      settings: { lastAutomaticUpdateCheckAt: '2026-04-19T09:00:00.000Z' }
    });

    await service.checkNow();

    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('logs launch check failures without surfacing an error state', async () => {
    const updater = new FakeUpdater();
    updater.checkForUpdates.mockRejectedValueOnce(new Error('Network failed'));
    const { service } = createService({ updater });

    await service.checkOnLaunch();

    expect(service.getState().status).toBe('idle');
    expect(service.getState().error).toBeUndefined();
    expect(logError).toHaveBeenCalled();
  });

  it('surfaces manual check failures', async () => {
    const updater = new FakeUpdater();
    updater.checkForUpdates.mockRejectedValueOnce(new Error('Network failed'));
    const { service } = createService({ updater });

    const result = await service.checkNow();

    expect(result.ok).toBe(false);
    expect(service.getState().status).toBe('error');
    expect(service.getState().error).toBe('Network failed');
  });

  it('install calls quitAndInstall with isSilent=true and isForceRunAfter=true', () => {
    const updater = new FakeUpdater();
    const { service } = createService({ updater });
    updater.emit('update-downloaded', { version: '1.2.3' });

    service.install();

    expect(updater.quitAndInstall).toHaveBeenCalledWith(true, true);
  });

  it('blocks install while media work is active', () => {
    const updater = new FakeUpdater();
    const { service } = createService({ updater, isMediaBusy: true });
    updater.emit('update-downloaded', { version: '1.2.3' });

    const result = service.install();

    expect(result.ok).toBe(false);
    expect(updater.quitAndInstall).not.toHaveBeenCalled();
  });

  it('retryDownload invokes downloadUpdate exactly once', async () => {
    const updater = new FakeUpdater();
    const { service } = createService({ updater });

    await service.retryDownload();

    expect(updater.downloadUpdate).toHaveBeenCalledTimes(1);
  });

  it('notifies state-change listeners when state transitions', () => {
    const updater = new FakeUpdater();
    const { service } = createService({ updater });
    const listener = vi.fn();
    const unsubscribe = service.onStateChange(listener);

    updater.emit('update-available', { version: '1.2.3' });

    expect(listener).toHaveBeenCalled();
    const lastCall = listener.mock.calls.at(-1)?.[0];
    expect(lastCall?.status).toBe('available');

    unsubscribe();
    listener.mockClear();
    updater.emit('update-not-available', { version: '1.2.4' });
    expect(listener).not.toHaveBeenCalled();
  });
});
