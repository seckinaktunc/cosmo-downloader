import { app } from 'electron';
import { join } from 'path';
import { createDefaultSettings } from '../../shared/defaults';
import type { AppSettings, PreferencesSectionsExpanded, SettingsUpdate } from '../../shared/types';
import { BufferedJsonFile, loadJsonFileState } from '../utils/jsonFileState';

const SETTINGS_FILE = 'settings.json';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

function normalizeCacheLimitMb(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(500, Math.max(1, Math.round(value)));
}

function normalizeHistoryLimitItems(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(5000, Math.max(1, Math.round(value)));
}

function mergePreferencesSectionsExpanded(
  defaults: PreferencesSectionsExpanded,
  saved: unknown
): PreferencesSectionsExpanded {
  if (!isRecord(saved)) {
    return defaults;
  }

  return {
    general: typeof saved.general === 'boolean' ? saved.general : defaults.general,
    metadata: typeof saved.metadata === 'boolean' ? saved.metadata : defaults.metadata
  };
}

export function mergeSettings(defaults: AppSettings, saved: unknown): AppSettings {
  if (!isRecord(saved)) {
    return defaults;
  }

  return {
    hardwareAcceleration:
      typeof saved.hardwareAcceleration === 'boolean'
        ? saved.hardwareAcceleration
        : defaults.hardwareAcceleration,
    automaticUpdates:
      typeof saved.automaticUpdates === 'boolean'
        ? saved.automaticUpdates
        : defaults.automaticUpdates,
    lastAutomaticUpdateCheckAt:
      typeof saved.lastAutomaticUpdateCheckAt === 'string' &&
      saved.lastAutomaticUpdateCheckAt.length > 0
        ? saved.lastAutomaticUpdateCheckAt
        : defaults.lastAutomaticUpdateCheckAt,
    lastNotifiedAppVersion:
      typeof saved.lastNotifiedAppVersion === 'string' && saved.lastNotifiedAppVersion.length > 0
        ? saved.lastNotifiedAppVersion
        : defaults.lastNotifiedAppVersion,
    createFolderPerDownload:
      typeof saved.createFolderPerDownload === 'boolean'
        ? saved.createFolderPerDownload
        : defaults.createFolderPerDownload,
    defaultDownloadLocation:
      typeof saved.defaultDownloadLocation === 'string' && saved.defaultDownloadLocation.length > 0
        ? saved.defaultDownloadLocation
        : defaults.defaultDownloadLocation,
    lastDownloadDirectory:
      typeof saved.lastDownloadDirectory === 'string' && saved.lastDownloadDirectory.length > 0
        ? saved.lastDownloadDirectory
        : defaults.lastDownloadDirectory,
    interfaceLanguage:
      typeof saved.interfaceLanguage === 'string' && saved.interfaceLanguage.length > 0
        ? saved.interfaceLanguage
        : defaults.interfaceLanguage,
    cookiesBrowser:
      typeof saved.cookiesBrowser === 'string'
        ? (saved.cookiesBrowser as AppSettings['cookiesBrowser'])
        : defaults.cookiesBrowser,
    alwaysOnTop: typeof saved.alwaysOnTop === 'boolean' ? saved.alwaysOnTop : defaults.alwaysOnTop,
    clipboardPrefetchEnabled:
      typeof saved.clipboardPrefetchEnabled === 'boolean'
        ? saved.clipboardPrefetchEnabled
        : defaults.clipboardPrefetchEnabled,
    cacheLimitMb: normalizeCacheLimitMb(saved.cacheLimitMb, defaults.cacheLimitMb),
    historyLimitItems: normalizeHistoryLimitItems(
      saved.historyLimitItems,
      defaults.historyLimitItems
    ),
    preferencesSectionsExpanded: mergePreferencesSectionsExpanded(
      defaults.preferencesSectionsExpanded,
      saved.preferencesSectionsExpanded
    )
  };
}

function getSettingsPath(userDataPath: string): string {
  return join(userDataPath, SETTINGS_FILE);
}

function loadSettingsStateFromFile(
  filePath: string,
  downloadsPath: string
): ReturnType<typeof loadJsonFileState<AppSettings>> {
  const defaults = createDefaultSettings(downloadsPath);
  return loadJsonFileState(filePath, {
    createFallback: () => defaults,
    deserialize: (saved) => mergeSettings(defaults, saved)
  });
}

function loadSettingsState(
  userDataPath: string,
  downloadsPath: string
): ReturnType<typeof loadJsonFileState<AppSettings>> {
  return loadSettingsStateFromFile(getSettingsPath(userDataPath), downloadsPath);
}

export class SettingsService {
  private settings: AppSettings | null = null;
  private readonly persistence: BufferedJsonFile<AppSettings>;

  constructor(private readonly filePath: string = getSettingsPath(app.getPath('userData'))) {
    this.persistence = new BufferedJsonFile(this.filePath, {
      getValue: () => this.get(),
      delayMs: 0
    });
  }

  get(): AppSettings {
    if (this.settings == null) {
      const loaded = loadSettingsStateFromFile(this.filePath, app.getPath('downloads'));
      this.settings = loaded.value;
      if (loaded.needsRewrite || loaded.wasMissing) {
        void this.persistence.flushNow();
      }
    }

    return this.settings;
  }

  async update(update: SettingsUpdate): Promise<AppSettings> {
    this.settings = mergeSettings(this.get(), { ...this.get(), ...update });
    await this.persistence.flushNow();
    return this.settings;
  }

  async dispose(): Promise<void> {
    await this.persistence.flushPendingOnDispose();
  }
}

export function readStartupHardwareAcceleration(): boolean {
  try {
    return loadSettingsState(app.getPath('userData'), app.getPath('downloads')).value
      .hardwareAcceleration;
  } catch {
    return true;
  }
}

export function readStartupAlwaysOnTop(): boolean {
  try {
    return loadSettingsState(app.getPath('userData'), app.getPath('downloads')).value.alwaysOnTop;
  } catch {
    return false;
  }
}
