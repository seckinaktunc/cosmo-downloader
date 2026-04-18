import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { createDefaultSettings } from '../../shared/defaults'
import type { AppSettings, SettingsUpdate } from '../../shared/types'

const SETTINGS_FILE = 'settings.json'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value)
}

export function mergeSettings(defaults: AppSettings, saved: unknown): AppSettings {
  if (!isRecord(saved)) {
    return defaults
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
    alwaysAskDownloadLocation:
      typeof saved.alwaysAskDownloadLocation === 'boolean'
        ? saved.alwaysAskDownloadLocation
        : defaults.alwaysAskDownloadLocation,
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
    alwaysOnTop: typeof saved.alwaysOnTop === 'boolean' ? saved.alwaysOnTop : defaults.alwaysOnTop
  }
}

export class SettingsService {
  private settings: AppSettings | null = null

  constructor(private readonly filePath: string = join(app.getPath('userData'), SETTINGS_FILE)) {}

  get(): AppSettings {
    if (this.settings == null) {
      this.settings = this.read()
    }

    return this.settings
  }

  update(update: SettingsUpdate): AppSettings {
    this.settings = { ...this.get(), ...update }
    this.write(this.settings)
    return this.settings
  }

  private read(): AppSettings {
    const defaults = createDefaultSettings(app.getPath('downloads'))
    if (!existsSync(this.filePath)) {
      this.write(defaults)
      return defaults
    }

    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as unknown
      return mergeSettings(defaults, parsed)
    } catch {
      return defaults
    }
  }

  private write(settings: AppSettings): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    writeFileSync(this.filePath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
  }
}

export function readStartupHardwareAcceleration(): boolean {
  try {
    const settingsPath = join(app.getPath('userData'), SETTINGS_FILE)
    if (!existsSync(settingsPath)) {
      return true
    }

    const parsed = JSON.parse(readFileSync(settingsPath, 'utf8')) as unknown
    if (isRecord(parsed) && typeof parsed.hardwareAcceleration === 'boolean') {
      return parsed.hardwareAcceleration
    }
  } catch {
    return true
  }

  return true
}

export function readStartupAlwaysOnTop(): boolean {
  try {
    const settingsPath = join(app.getPath('userData'), SETTINGS_FILE)
    if (!existsSync(settingsPath)) {
      return false
    }

    const parsed = JSON.parse(readFileSync(settingsPath, 'utf8')) as unknown
    if (isRecord(parsed) && typeof parsed.alwaysOnTop === 'boolean') {
      return parsed.alwaysOnTop
    }
  } catch {
    return false
  }

  return false
}
