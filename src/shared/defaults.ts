import type { AppSettings, ExportSettings } from './types'

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  outputFormat: 'mp4',
  resolution: 'auto',
  videoBitrate: 'auto',
  audioBitrate: 'auto',
  frameRate: 'auto',
  videoCodec: 'auto',
  audioCodec: 'auto'
}

function isRecord(value: unknown): value is Partial<ExportSettings> {
  return typeof value === 'object' && value != null && !Array.isArray(value)
}

export function mergeExportSettings(value: unknown): ExportSettings {
  if (!isRecord(value)) {
    return { ...DEFAULT_EXPORT_SETTINGS }
  }

  return {
    ...DEFAULT_EXPORT_SETTINGS,
    ...value
  }
}

export function createDefaultSettings(downloadsPath: string): AppSettings {
  return {
    hardwareAcceleration: true,
    automaticUpdates: true,
    alwaysAskDownloadLocation: false,
    defaultDownloadLocation: downloadsPath,
    interfaceLanguage: 'en_US',
    cookiesBrowser: 'none',
    alwaysOnTop: false
  }
}
