import { create } from 'zustand'
import type {
  AppEnvironment,
  AppSettings,
  CookieBrowserOption,
  OutputFormat,
  SettingsUpdate
} from '../../../shared/types'

type SettingsState = {
  settings: AppSettings | null
  environment: AppEnvironment | null
  cookieBrowsers: CookieBrowserOption[]
  restartRequired: boolean
  initialHardwareAcceleration: boolean | null
  isLoading: boolean
  error?: string
  load: () => Promise<void>
  update: (update: SettingsUpdate) => Promise<void>
  chooseDownloadDirectory: () => Promise<void>
  chooseOutputPath: (request: {
    title: string
    outputFormat: OutputFormat
    currentPath?: string
  }) => Promise<string | null>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  environment: null,
  cookieBrowsers: [{ id: 'none', label: 'None', exists: true }],
  restartRequired: false,
  initialHardwareAcceleration: null,
  isLoading: false,

  load: async () => {
    set({ isLoading: true, error: undefined })
    const [settingsResult, browsersResult, environmentResult] = await Promise.all([
      window.cosmo.settings.get(),
      window.cosmo.system.detectCookieBrowsers(),
      window.cosmo.app.getEnvironment()
    ])

    set({
      isLoading: false,
      settings: settingsResult.ok ? settingsResult.data : null,
      initialHardwareAcceleration: settingsResult.ok
        ? settingsResult.data.hardwareAcceleration
        : null,
      restartRequired: false,
      cookieBrowsers: browsersResult.ok
        ? browsersResult.data
        : [{ id: 'none', label: 'None', exists: true }],
      environment: environmentResult.ok ? environmentResult.data : null,
      error: !settingsResult.ok ? settingsResult.error.message : undefined
    })
  },

  update: async (update) => {
    const result = await window.cosmo.settings.update(update)
    if (!result.ok) {
      set({ error: result.error.message })
      return
    }

    const initialHardwareAcceleration = get().initialHardwareAcceleration
    set({
      settings: result.data,
      restartRequired:
        initialHardwareAcceleration != null &&
        result.data.hardwareAcceleration !== initialHardwareAcceleration
    })
  },

  chooseDownloadDirectory: async () => {
    const result = await window.cosmo.settings.chooseDownloadDirectory()
    if (result.ok && result.data) {
      await get().update({ defaultDownloadLocation: result.data })
    }
  },

  chooseOutputPath: async ({ title, outputFormat, currentPath }) => {
    const settings = get().settings
    const result = await window.cosmo.settings.chooseOutputPath({
      title,
      outputFormat,
      currentPath,
      defaultDirectory: settings?.lastDownloadDirectory ?? settings?.defaultDownloadLocation
    })

    if (!result.ok || !result.data) {
      if (result.ok) {
        return null
      }

      set({ error: result.error.message })
      return null
    }

    await get().update({ lastDownloadDirectory: result.data.directory })
    return result.data.filePath
  }
}))
