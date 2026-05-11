import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { app, webContents } from 'electron';
import log from 'electron-log/main';
import { autoUpdater } from 'electron-updater';
import { IPC_CHANNELS } from '../../shared/ipc';
import type {
  IpcResult,
  UpdateDownloadProgress,
  UpdateInfoSummary,
  UpdateState
} from '../../shared/types';
import { fail, ok } from '../utils/ipcResult';
import type { SettingsService } from './settingsService';

const MAC_UPDATE_BASE_URL =
  'https://github.com/seckinaktunc/cosmo-downloader/releases/latest/download/';
const MAC_UPDATER_CACHE_DIR_NAME = 'cosmo-downloader-updater';
const RELEASE_PAGE_BASE_URL = 'https://github.com/seckinaktunc/cosmo-downloader/releases/tag/v';

type UpdateCheckMode = 'launch' | 'manual';

type MinimalUpdateInfo = {
  version?: string;
  releaseName?: string | null;
  releaseDate?: string | null;
  releaseNotes?: unknown;
};

type MinimalProgressInfo = {
  percent?: number;
  transferred?: number;
  total?: number;
  bytesPerSecond?: number;
};

type UpdaterClient = {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  allowPrerelease: boolean;
  logger: unknown;
  updateConfigPath?: string;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  checkForUpdates: () => Promise<unknown>;
  downloadUpdate: () => Promise<unknown>;
  quitAndInstall: (isSilent?: boolean, isForceRunAfter?: boolean) => void;
  getFeedURL?: () => string | null | undefined;
  setFeedURL?: (options: { provider: 'generic'; url: string; channel: string }) => void;
};

type UpdateServiceOptions = {
  updater?: UpdaterClient;
  isPackaged?: () => boolean;
  isMediaBusy?: () => boolean;
  now?: () => Date;
  platform?: NodeJS.Platform;
  arch?: string;
  userDataPath?: string;
};

type MacUpdateConfig = {
  provider: 'generic';
  url: string;
  channel: string;
  updaterCacheDirName: string;
};

function normalizeReleaseNotes(notes: unknown): string | undefined {
  if (typeof notes === 'string') {
    return notes;
  }

  if (Array.isArray(notes)) {
    return notes
      .map((note) => {
        if (typeof note === 'string') {
          return note;
        }

        if (typeof note === 'object' && note != null && 'note' in note) {
          const value = (note as { note?: unknown }).note;
          return typeof value === 'string' ? value : undefined;
        }

        return undefined;
      })
      .filter((note): note is string => Boolean(note))
      .join('\n');
  }

  return undefined;
}

function summarizeUpdateInfo(info: MinimalUpdateInfo): UpdateInfoSummary {
  return {
    version: info.version ?? 'unknown',
    releaseName: info.releaseName ?? undefined,
    releaseDate: info.releaseDate ?? undefined,
    releaseNotes: normalizeReleaseNotes(info.releaseNotes)
  };
}

function summarizeProgress(info: MinimalProgressInfo): UpdateDownloadProgress {
  return {
    percent: Math.max(0, Math.min(100, Math.round(info.percent ?? 0))),
    transferred: info.transferred,
    total: info.total,
    bytesPerSecond: info.bytesPerSecond
  };
}

export function getMacUpdateChannel(arch: string): string {
  return arch === 'arm64' ? 'latest-arm64' : 'latest-x64';
}

export function getMacUpdateConfig(arch: string): MacUpdateConfig {
  return {
    provider: 'generic',
    url: MAC_UPDATE_BASE_URL,
    channel: getMacUpdateChannel(arch),
    updaterCacheDirName: MAC_UPDATER_CACHE_DIR_NAME
  };
}

export function serializeMacUpdateConfig(config: MacUpdateConfig): string {
  return [
    `provider: ${JSON.stringify(config.provider)}`,
    `url: ${JSON.stringify(config.url)}`,
    `channel: ${JSON.stringify(config.channel)}`,
    `updaterCacheDirName: ${JSON.stringify(config.updaterCacheDirName)}`,
    ''
  ].join('\n');
}

export function getMacUpdateConfigPath(userDataPath: string): string {
  return join(userDataPath, 'app-update.yml');
}

export function ensureMacUpdateConfigFile(userDataPath: string, arch: string): string {
  mkdirSync(userDataPath, { recursive: true });

  const configPath = getMacUpdateConfigPath(userDataPath);
  writeFileSync(configPath, serializeMacUpdateConfig(getMacUpdateConfig(arch)), 'utf8');
  return configPath;
}

export function shouldUseArchSpecificMacFeed(
  platform: NodeJS.Platform,
  isPackaged: boolean
): boolean {
  return platform === 'darwin' && isPackaged;
}

export function getReleasePageUrl(version: string): string {
  return `${RELEASE_PAGE_BASE_URL}${version}`;
}

export class UpdateService {
  private readonly updater: UpdaterClient;
  private readonly isPackaged: () => boolean;
  private readonly isMediaBusy: () => boolean;
  private readonly now: () => Date;
  private readonly platform: NodeJS.Platform;
  private readonly arch: string;
  private readonly userDataPath: string;
  private state: UpdateState = { status: 'idle' };
  private activeCheckMode: UpdateCheckMode | null = null;
  private readonly stateListeners = new Set<(state: UpdateState) => void>();

  constructor(
    private readonly settingsService: SettingsService,
    options: UpdateServiceOptions = {}
  ) {
    this.updater = options.updater ?? (autoUpdater as unknown as UpdaterClient);
    this.isPackaged = options.isPackaged ?? (() => app.isPackaged);
    this.isMediaBusy = options.isMediaBusy ?? (() => false);
    this.now = options.now ?? (() => new Date());
    this.platform = options.platform ?? process.platform;
    this.arch = options.arch ?? process.arch;
    this.userDataPath = options.userDataPath ?? app.getPath?.('userData') ?? process.cwd();

    this.updater.autoDownload = false;
    this.updater.autoInstallOnAppQuit = true;
    this.updater.allowPrerelease = false;
    this.updater.logger = log;
    this.configureMacFeed();
    this.registerUpdaterEvents();
  }

  getState(): UpdateState {
    return this.state;
  }

  onStateChange(listener: (state: UpdateState) => void): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  async checkOnLaunch(): Promise<IpcResult<UpdateState>> {
    if (!this.settingsService.get().automaticUpdates) {
      return ok(this.state);
    }

    return this.checkForUpdates('launch');
  }

  async checkNow(): Promise<IpcResult<UpdateState>> {
    return this.checkForUpdates('manual');
  }

  async download(): Promise<IpcResult<UpdateState>> {
    if (this.state.status === 'downloaded') {
      return ok(this.state);
    }

    if (this.state.status !== 'available') {
      return fail('VALIDATION_ERROR', 'No update is ready to download.');
    }

    this.setState({
      ...this.state,
      status: 'downloading',
      progress: { percent: 0 },
      error: undefined
    });

    try {
      await this.updater.downloadUpdate();
      return ok(this.state);
    } catch (error) {
      this.handleError(error);
      return fail('PROCESS_FAILED', this.errorMessage(error));
    }
  }

  async retryDownload(): Promise<IpcResult<UpdateState>> {
    this.setState({
      ...this.state,
      status: 'downloading',
      progress: { percent: 0 },
      error: undefined
    });

    try {
      await this.updater.downloadUpdate();
      return ok(this.state);
    } catch (error) {
      this.handleError(error);
      return fail('PROCESS_FAILED', this.errorMessage(error));
    }
  }

  install(): IpcResult<UpdateState> {
    if (this.state.status !== 'downloaded') {
      return fail('VALIDATION_ERROR', 'No downloaded update is ready to install.');
    }

    if (this.isMediaBusy()) {
      return fail('BUSY', 'Finish active downloads before restarting to install the update.');
    }

    this.updater.quitAndInstall(true, true);
    return ok(this.state);
  }

  private async checkForUpdates(mode: UpdateCheckMode): Promise<IpcResult<UpdateState>> {
    const unavailableReason = this.getUnavailableReason();
    if (unavailableReason) {
      const state: UpdateState = {
        status: 'unavailable',
        unavailableReason,
        error: mode === 'manual' ? unavailableReason : undefined
      };
      if (mode === 'manual') {
        this.setState(state);
      } else {
        log.info(`[updates] ${unavailableReason}`);
      }
      return ok(mode === 'manual' ? this.state : state);
    }

    this.activeCheckMode = mode;

    this.setState({
      status: 'checking',
      checkedAt: this.now().toISOString(),
      error: undefined,
      unavailableReason: undefined
    });

    try {
      const result = await this.updater.checkForUpdates();
      if (result == null) {
        this.setState({
          status: 'unavailable',
          unavailableReason: 'Update feed is not configured.',
          error: mode === 'manual' ? 'Update feed is not configured.' : undefined
        });
      }
      return ok(this.state);
    } catch (error) {
      this.handleError(error);
      return mode === 'manual' ? fail('PROCESS_FAILED', this.errorMessage(error)) : ok(this.state);
    } finally {
      this.activeCheckMode = null;
    }
  }

  private getUnavailableReason(): string | null {
    if (!this.isPackaged()) {
      return 'Updates are available only in packaged production builds.';
    }

    const feedUrl = this.updater.getFeedURL?.();
    if (feedUrl === null) {
      return 'Update feed is not configured.';
    }

    return null;
  }

  private configureMacFeed(): void {
    if (!shouldUseArchSpecificMacFeed(this.platform, this.isPackaged())) {
      return;
    }

    try {
      this.updater.updateConfigPath = ensureMacUpdateConfigFile(this.userDataPath, this.arch);
    } catch (error) {
      log.warn(`[updates] Failed to prepare macOS updater config: ${this.errorMessage(error)}`);
    }

    this.updater.setFeedURL?.({
      provider: 'generic',
      url: MAC_UPDATE_BASE_URL,
      channel: getMacUpdateChannel(this.arch)
    });
  }

  private registerUpdaterEvents(): void {
    this.updater.on('checking-for-update', () => {
      this.setState({ ...this.state, status: 'checking', error: undefined });
    });

    this.updater.on('update-not-available', (info) => {
      this.setState({
        status: 'not_available',
        updateInfo: summarizeUpdateInfo((info ?? {}) as MinimalUpdateInfo),
        checkedAt: this.now().toISOString(),
        error: undefined
      });
    });

    this.updater.on('update-available', (info) => {
      this.setState({
        status: 'available',
        updateInfo: summarizeUpdateInfo((info ?? {}) as MinimalUpdateInfo),
        checkedAt: this.now().toISOString(),
        error: undefined
      });
    });

    this.updater.on('download-progress', (info) => {
      this.setState({
        ...this.state,
        status: 'downloading',
        progress: summarizeProgress((info ?? {}) as MinimalProgressInfo),
        error: undefined
      });
    });

    this.updater.on('update-downloaded', (event) => {
      this.setState({
        status: 'downloaded',
        updateInfo: summarizeUpdateInfo(
          (event ?? this.state.updateInfo ?? {}) as MinimalUpdateInfo
        ),
        progress: { percent: 100 },
        checkedAt: this.state.checkedAt,
        error: undefined
      });
    });

    this.updater.on('error', (error) => {
      this.handleError(error);
    });
  }

  private handleError(error: unknown): void {
    const message = this.errorMessage(error);
    log.error('[updates]', message);

    if (this.activeCheckMode === 'launch') {
      this.setState({ status: 'idle' });
      return;
    }

    this.setState({
      ...this.state,
      status: 'error',
      error: message
    });
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private setState(state: UpdateState): void {
    this.state = state;
    this.broadcast();
    for (const listener of this.stateListeners) {
      listener(state);
    }
  }

  private broadcast(): void {
    for (const contents of webContents.getAllWebContents()) {
      if (!contents.isDestroyed()) {
        contents.send(IPC_CHANNELS.updates.state, this.state);
      }
    }
  }
}
