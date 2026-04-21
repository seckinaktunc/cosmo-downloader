import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppEnvironment, AppSettings, CookieBrowserOption, IpcResult } from '@shared/types'
import { useSettingsStore } from '@renderer/stores/settingsStore'

const baseSettings: AppSettings = {
  hardwareAcceleration: true,
  automaticUpdates: true,
  alwaysAskDownloadLocation: false,
  createFolderPerDownload: false,
  defaultDownloadLocation: '/downloads',
  lastDownloadDirectory: '/downloads',
  interfaceLanguage: 'en_US',
  cookiesBrowser: 'none',
  alwaysOnTop: false
}

const environment: AppEnvironment = {
  platform: 'win32',
  isPackaged: false,
  version: '1.0.0',
  hardwareAccelerationAvailable: true
}

const browsers: CookieBrowserOption[] = [{ id: 'none', label: 'None', exists: true }]

function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data }
}

function fail<T>(message: string): IpcResult<T> {
  return { ok: false, error: { code: 'UNKNOWN', message } }
}

function installCosmoMock(initialSettings = baseSettings): {
  currentSettings: AppSettings
  updateMock: ReturnType<typeof vi.fn>
} {
  const state = { currentSettings: initialSettings }
  const updateMock = vi.fn(async (update: Partial<AppSettings>) => {
    state.currentSettings = { ...state.currentSettings, ...update }
    return ok(state.currentSettings)
  })

  vi.stubGlobal('window', {
    cosmo: {
      settings: {
        get: vi.fn(async () => ok(state.currentSettings)),
        update: updateMock,
        chooseDownloadDirectory: vi.fn(),
        chooseOutputPath: vi.fn()
      },
      system: {
        detectCookieBrowsers: vi.fn(async () => ok(browsers))
      },
      app: {
        getEnvironment: vi.fn(async () => ok(environment))
      }
    }
  })

  return {
    get currentSettings() {
      return state.currentSettings
    },
    updateMock
  }
}

beforeEach(() => {
  vi.unstubAllGlobals()
  useSettingsStore.setState({
    settings: null,
    environment: null,
    cookieBrowsers: [{ id: 'none', label: 'None', exists: true }],
    restartRequired: false,
    initialHardwareAcceleration: null,
    isLoading: false,
    error: undefined
  })
})

describe('useSettingsStore restart warning', () => {
  it('loads the startup hardware acceleration baseline without warning', async () => {
    installCosmoMock()

    await useSettingsStore.getState().load()

    expect(useSettingsStore.getState().initialHardwareAcceleration).toBe(true)
    expect(useSettingsStore.getState().restartRequired).toBe(false)
  })

  it('sets restart required when hardware acceleration differs from startup value', async () => {
    installCosmoMock()
    await useSettingsStore.getState().load()

    await useSettingsStore.getState().update({ hardwareAcceleration: false })

    expect(useSettingsStore.getState().settings?.hardwareAcceleration).toBe(false)
    expect(useSettingsStore.getState().restartRequired).toBe(true)
  })

  it('clears restart required when hardware acceleration returns to startup value', async () => {
    installCosmoMock()
    await useSettingsStore.getState().load()

    await useSettingsStore.getState().update({ hardwareAcceleration: false })
    await useSettingsStore.getState().update({ hardwareAcceleration: true })

    expect(useSettingsStore.getState().settings?.hardwareAcceleration).toBe(true)
    expect(useSettingsStore.getState().restartRequired).toBe(false)
  })

  it('keeps the warning derived from current saved settings after unrelated updates', async () => {
    installCosmoMock()
    await useSettingsStore.getState().load()

    await useSettingsStore.getState().update({ hardwareAcceleration: false })
    await useSettingsStore.getState().update({ automaticUpdates: false })

    expect(useSettingsStore.getState().restartRequired).toBe(true)
  })

  it('does not change restart warning after failed settings updates', async () => {
    const { updateMock } = installCosmoMock()
    await useSettingsStore.getState().load()
    updateMock.mockResolvedValueOnce(fail('Unable to save settings'))

    await useSettingsStore.getState().update({ hardwareAcceleration: false })

    expect(useSettingsStore.getState().settings?.hardwareAcceleration).toBe(true)
    expect(useSettingsStore.getState().restartRequired).toBe(false)
    expect(useSettingsStore.getState().error).toBe('Unable to save settings')
  })
})
