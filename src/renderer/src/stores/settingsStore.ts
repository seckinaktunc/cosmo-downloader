import { create } from 'zustand'
import type {
  AppEnvironment,
  AppSettings,
  CookieBrowserOption,
  SettingsUpdate
} from '../../../shared/types'

type SettingsState = {
  settings: AppSettings | null
  environment: AppEnvironment | null
  cookieBrowsers: CookieBrowserOption[]
  restartRequired: boolean
  isLoading: boolean
  error?: string
  load: () => Promise<void>
  update: (update: SettingsUpdate) => Promise<void>
  chooseDownloadDirectory: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  environment: null,
  cookieBrowsers: [{ id: 'none', label: 'None', exists: true }],
  restartRequired: false,
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
      cookieBrowsers: browsersResult.ok
        ? browsersResult.data
        : [{ id: 'none', label: 'None', exists: true }],
      environment: environmentResult.ok ? environmentResult.data : null,
      error: !settingsResult.ok ? settingsResult.error.message : undefined
    })
  },

  update: async (update) => {
    const current = get().settings
    const result = await window.cosmo.settings.update(update)
    if (!result.ok) {
      set({ error: result.error.message })
      return
    }

    set({
      settings: result.data,
      restartRequired:
        get().restartRequired ||
        (current != null &&
          update.hardwareAcceleration != null &&
          current.hardwareAcceleration !== update.hardwareAcceleration)
    })
  },

  chooseDownloadDirectory: async () => {
    const result = await window.cosmo.settings.chooseDownloadDirectory()
    if (result.ok && result.data) {
      await get().update({ defaultDownloadLocation: result.data })
    }
  }
}))
