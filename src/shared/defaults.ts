import type { AppSettings, ExportSettings } from './types'

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  outputFormat: 'mp4',
  resolution: 'auto',
  audioBitrate: 'auto',
  frameRate: 'auto',
  videoCodec: 'auto',
  audioCodec: 'auto'
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
