import type { AppSettings, ExportSettings } from './types'

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  outputFormat: 'mp4',
  resolution: 'auto',
  videoBitrate: 'auto',
  audioBitrate: 'auto',
  frameRate: 'auto',
  trimStartSeconds: 0,
  trimEndSeconds: undefined,
  videoCodec: 'auto',
  audioCodec: 'auto',
  savePath: undefined
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
    ...value,
    trimStartSeconds:
      typeof value.trimStartSeconds === 'number' && Number.isFinite(value.trimStartSeconds)
        ? Math.max(0, Math.round(value.trimStartSeconds))
        : DEFAULT_EXPORT_SETTINGS.trimStartSeconds,
    trimEndSeconds:
      typeof value.trimEndSeconds === 'number' && Number.isFinite(value.trimEndSeconds)
        ? Math.max(0, Math.round(value.trimEndSeconds))
        : undefined,
    savePath:
      typeof value.savePath === 'string' && value.savePath.trim().length > 0
        ? value.savePath
        : undefined
  }
}

export function createDefaultSettings(downloadsPath: string): AppSettings {
  return {
    hardwareAcceleration: true,
    automaticUpdates: true,
    lastAutomaticUpdateCheckAt: undefined,
    alwaysAskDownloadLocation: false,
    createFolderPerDownload: false,
    defaultDownloadLocation: downloadsPath,
    lastDownloadDirectory: downloadsPath,
    interfaceLanguage: 'en_US',
    cookiesBrowser: 'none',
    alwaysOnTop: false
  }
}
