import { EventEmitter } from 'events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppSettings, SettingsUpdate } from '../../shared/types'
import type { SettingsService } from './settingsService'
import { shouldRunAutomaticUpdateCheck, UpdateService } from './updateService'

vi.mock('electron', () => ({
  app: {
    isPackaged: true
  },
  webContents: {
    getAllWebContents: () => []
  }
}))

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
}))

const logError = vi.hoisted(() => vi.fn())
vi.mock('electron-log/main', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: logError
  }
}))

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

class FakeUpdater extends EventEmitter {
  autoDownload = true
  autoInstallOnAppQuit = false
  allowPrerelease = true
  logger: unknown = null
  checkForUpdates = vi.fn(async () => ({}))
  downloadUpdate = vi.fn(async () => [])
  quitAndInstall = vi.fn()
  getFeedURL = vi.fn(() => 'https://github.com/seckinaktunc/cosmo-downloader')
}

function createSettingsService(initial: Partial<AppSettings> = {}): SettingsService {
  let settings = { ...baseSettings, ...initial }
  return {
    get: () => settings,
    update: (update: SettingsUpdate) => {
      settings = { ...settings, ...update }
      return settings
    }
  } as SettingsService
}

function createService({
  settings = {},
  updater = new FakeUpdater(),
  isPackaged = true,
  isMediaBusy = false,
  now = new Date('2026-04-19T10:00:00.000Z')
}: {
  settings?: Partial<AppSettings>
  updater?: FakeUpdater
  isPackaged?: boolean
  isMediaBusy?: boolean
  now?: Date
} = {}): { service: UpdateService; updater: FakeUpdater; settingsService: SettingsService } {
  const settingsService = createSettingsService(settings)
  const service = new UpdateService(settingsService, {
    updater,
    isPackaged: () => isPackaged,
    isMediaBusy: () => isMediaBusy,
    now: () => now,
    startupDelayMs: 1,
    intervalMs: 24 * 60 * 60 * 1000
  })

  return { service, updater, settingsService }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('shouldRunAutomaticUpdateCheck', () => {
  it('runs when there is no previous check or the timestamp is stale', () => {
    const now = new Date('2026-04-19T10:00:00.000Z')

    expect(shouldRunAutomaticUpdateCheck(undefined, now)).toBe(true)
    expect(shouldRunAutomaticUpdateCheck('2026-04-17T10:00:00.000Z', now)).toBe(true)
  })

  it('skips when the previous check is recent', () => {
    expect(
      shouldRunAutomaticUpdateCheck(
        '2026-04-19T09:00:00.000Z',
        new Date('2026-04-19T10:00:00.000Z')
      )
    ).toBe(false)
  })
})

describe('UpdateService', () => {
  it('guards manual checks in unpackaged builds', async () => {
    const { service, updater } = createService({ isPackaged: false })

    const result = await service.checkNow()

    expect(result.ok).toBe(true)
    expect(service.getState().status).toBe('unavailable')
    expect(updater.checkForUpdates).not.toHaveBeenCalled()
  })

  it('respects the automatic check throttle', async () => {
    const { service, updater } = createService({
      settings: { lastAutomaticUpdateCheckAt: '2026-04-19T09:00:00.000Z' }
    })

    await service.checkAutomatic()

    expect(updater.checkForUpdates).not.toHaveBeenCalled()
  })

  it('lets manual checks bypass the automatic throttle', async () => {
    const { service, updater } = createService({
      settings: { lastAutomaticUpdateCheckAt: '2026-04-19T09:00:00.000Z' }
    })

    await service.checkNow()

    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
  })

  it('logs automatic check failures without surfacing an error state', async () => {
    const updater = new FakeUpdater()
    updater.checkForUpdates.mockRejectedValueOnce(new Error('Network failed'))
    const { service } = createService({ updater })

    await service.checkAutomatic()

    expect(service.getState().status).toBe('idle')
    expect(service.getState().error).toBeUndefined()
    expect(logError).toHaveBeenCalled()
  })

  it('surfaces manual check failures', async () => {
    const updater = new FakeUpdater()
    updater.checkForUpdates.mockRejectedValueOnce(new Error('Network failed'))
    const { service } = createService({ updater })

    const result = await service.checkNow()

    expect(result.ok).toBe(false)
    expect(service.getState().status).toBe('error')
    expect(service.getState().error).toBe('Network failed')
  })

  it('blocks install while media work is active', () => {
    const updater = new FakeUpdater()
    const { service } = createService({ updater, isMediaBusy: true })
    updater.emit('update-downloaded', { version: '1.2.3' })

    const result = service.install()

    expect(result.ok).toBe(false)
    expect(updater.quitAndInstall).not.toHaveBeenCalled()
  })
})
