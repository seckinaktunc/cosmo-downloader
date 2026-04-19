import { app, webContents } from 'electron'
import log from 'electron-log/main'
import { autoUpdater } from 'electron-updater'
import { IPC_CHANNELS } from '../../shared/ipc'
import type {
  IpcResult,
  UpdateDownloadProgress,
  UpdateInfoSummary,
  UpdateState
} from '../../shared/types'
import { fail, ok } from '../utils/ipcResult'
import type { SettingsService } from './settingsService'

const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000
const STARTUP_UPDATE_CHECK_DELAY_MS = 5_000

type UpdateCheckMode = 'automatic' | 'manual'

type MinimalUpdateInfo = {
  version?: string
  releaseName?: string | null
  releaseDate?: string | null
  releaseNotes?: unknown
}

type MinimalProgressInfo = {
  percent?: number
  transferred?: number
  total?: number
  bytesPerSecond?: number
}

type UpdaterClient = {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  allowPrerelease: boolean
  logger: unknown
  on: (event: string, listener: (...args: unknown[]) => void) => void
  checkForUpdates: () => Promise<unknown>
  downloadUpdate: () => Promise<unknown>
  quitAndInstall: (isSilent?: boolean, isForceRunAfter?: boolean) => void
  getFeedURL?: () => string | null | undefined
}

type UpdateServiceOptions = {
  updater?: UpdaterClient
  isPackaged?: () => boolean
  isMediaBusy?: () => boolean
  now?: () => Date
  startupDelayMs?: number
  intervalMs?: number
}

function normalizeReleaseNotes(notes: unknown): string | undefined {
  if (typeof notes === 'string') {
    return notes
  }

  if (Array.isArray(notes)) {
    return notes
      .map((note) => {
        if (typeof note === 'string') {
          return note
        }

        if (typeof note === 'object' && note != null && 'note' in note) {
          const value = (note as { note?: unknown }).note
          return typeof value === 'string' ? value : undefined
        }

        return undefined
      })
      .filter((note): note is string => Boolean(note))
      .join('\n')
  }

  return undefined
}

function summarizeUpdateInfo(info: MinimalUpdateInfo): UpdateInfoSummary {
  return {
    version: info.version ?? 'unknown',
    releaseName: info.releaseName ?? undefined,
    releaseDate: info.releaseDate ?? undefined,
    releaseNotes: normalizeReleaseNotes(info.releaseNotes)
  }
}

function summarizeProgress(info: MinimalProgressInfo): UpdateDownloadProgress {
  return {
    percent: Math.max(0, Math.min(100, Math.round(info.percent ?? 0))),
    transferred: info.transferred,
    total: info.total,
    bytesPerSecond: info.bytesPerSecond
  }
}

export function shouldRunAutomaticUpdateCheck(
  lastCheckAt: string | undefined,
  now: Date,
  intervalMs = UPDATE_CHECK_INTERVAL_MS
): boolean {
  if (!lastCheckAt) {
    return true
  }

  const timestamp = Date.parse(lastCheckAt)
  return Number.isNaN(timestamp) || now.getTime() - timestamp >= intervalMs
}

export class UpdateService {
  private readonly updater: UpdaterClient
  private readonly isPackaged: () => boolean
  private readonly isMediaBusy: () => boolean
  private readonly now: () => Date
  private readonly startupDelayMs: number
  private readonly intervalMs: number
  private state: UpdateState = { status: 'idle' }
  private activeCheckMode: UpdateCheckMode | null = null
  private automaticInterval: NodeJS.Timeout | null = null
  private automaticTimeout: NodeJS.Timeout | null = null

  constructor(
    private readonly settingsService: SettingsService,
    options: UpdateServiceOptions = {}
  ) {
    this.updater = options.updater ?? (autoUpdater as unknown as UpdaterClient)
    this.isPackaged = options.isPackaged ?? (() => app.isPackaged)
    this.isMediaBusy = options.isMediaBusy ?? (() => false)
    this.now = options.now ?? (() => new Date())
    this.startupDelayMs = options.startupDelayMs ?? STARTUP_UPDATE_CHECK_DELAY_MS
    this.intervalMs = options.intervalMs ?? UPDATE_CHECK_INTERVAL_MS

    this.updater.autoDownload = false
    this.updater.autoInstallOnAppQuit = true
    this.updater.allowPrerelease = false
    this.updater.logger = log
    this.registerUpdaterEvents()
  }

  getState(): UpdateState {
    return this.state
  }

  scheduleAutomaticChecks(): void {
    this.clearScheduledChecks()
    this.automaticTimeout = setTimeout(() => {
      void this.checkAutomatic()
      this.automaticInterval = setInterval(() => {
        void this.checkAutomatic()
      }, this.intervalMs)
    }, this.startupDelayMs)
  }

  clearScheduledChecks(): void {
    if (this.automaticTimeout) {
      clearTimeout(this.automaticTimeout)
      this.automaticTimeout = null
    }

    if (this.automaticInterval) {
      clearInterval(this.automaticInterval)
      this.automaticInterval = null
    }
  }

  async checkAutomatic(): Promise<IpcResult<UpdateState>> {
    const settings = this.settingsService.get()
    if (!settings.automaticUpdates) {
      return ok(this.state)
    }

    if (
      !shouldRunAutomaticUpdateCheck(
        settings.lastAutomaticUpdateCheckAt,
        this.now(),
        this.intervalMs
      )
    ) {
      return ok(this.state)
    }

    return this.checkForUpdates('automatic')
  }

  async checkNow(): Promise<IpcResult<UpdateState>> {
    return this.checkForUpdates('manual')
  }

  async download(): Promise<IpcResult<UpdateState>> {
    if (this.state.status === 'downloaded') {
      return ok(this.state)
    }

    if (this.state.status !== 'available') {
      return fail('VALIDATION_ERROR', 'No update is ready to download.')
    }

    this.activeCheckMode = 'manual'
    this.setState({
      ...this.state,
      status: 'downloading',
      progress: { percent: 0 },
      error: undefined
    })

    try {
      await this.updater.downloadUpdate()
      return ok(this.state)
    } catch (error) {
      this.handleError(error)
      return fail('PROCESS_FAILED', this.errorMessage(error))
    }
  }

  install(): IpcResult<UpdateState> {
    if (this.state.status !== 'downloaded') {
      return fail('VALIDATION_ERROR', 'No downloaded update is ready to install.')
    }

    if (this.isMediaBusy()) {
      return fail('BUSY', 'Finish active downloads before restarting to install the update.')
    }

    this.updater.quitAndInstall(false, true)
    return ok(this.state)
  }

  private async checkForUpdates(mode: UpdateCheckMode): Promise<IpcResult<UpdateState>> {
    const unavailableReason = this.getUnavailableReason()
    if (unavailableReason) {
      const state: UpdateState = {
        status: 'unavailable',
        unavailableReason,
        error: mode === 'manual' ? unavailableReason : undefined
      }
      if (mode === 'manual') {
        this.setState(state)
      } else {
        log.info(`[updates] ${unavailableReason}`)
      }
      return ok(mode === 'manual' ? this.state : state)
    }

    this.activeCheckMode = mode
    if (mode === 'automatic') {
      this.settingsService.update({ lastAutomaticUpdateCheckAt: this.now().toISOString() })
    }

    this.setState({
      status: 'checking',
      checkedAt: this.now().toISOString(),
      error: undefined,
      unavailableReason: undefined
    })

    try {
      const result = await this.updater.checkForUpdates()
      if (result == null) {
        this.setState({
          status: 'unavailable',
          unavailableReason: 'Update feed is not configured.',
          error: mode === 'manual' ? 'Update feed is not configured.' : undefined
        })
      }
      return ok(this.state)
    } catch (error) {
      this.handleError(error)
      return mode === 'manual' ? fail('PROCESS_FAILED', this.errorMessage(error)) : ok(this.state)
    } finally {
      this.activeCheckMode = null
    }
  }

  private getUnavailableReason(): string | null {
    if (!this.isPackaged()) {
      return 'Updates are available only in packaged production builds.'
    }

    const feedUrl = this.updater.getFeedURL?.()
    if (feedUrl === null) {
      return 'Update feed is not configured.'
    }

    return null
  }

  private registerUpdaterEvents(): void {
    this.updater.on('checking-for-update', () => {
      this.setState({ ...this.state, status: 'checking', error: undefined })
    })

    this.updater.on('update-not-available', (info) => {
      this.setState({
        status: 'not_available',
        updateInfo: summarizeUpdateInfo((info ?? {}) as MinimalUpdateInfo),
        checkedAt: this.now().toISOString(),
        error: undefined
      })
    })

    this.updater.on('update-available', (info) => {
      this.setState({
        status: 'available',
        updateInfo: summarizeUpdateInfo((info ?? {}) as MinimalUpdateInfo),
        checkedAt: this.now().toISOString(),
        error: undefined
      })
    })

    this.updater.on('download-progress', (info) => {
      this.setState({
        ...this.state,
        status: 'downloading',
        progress: summarizeProgress((info ?? {}) as MinimalProgressInfo),
        error: undefined
      })
    })

    this.updater.on('update-downloaded', (event) => {
      this.setState({
        status: 'downloaded',
        updateInfo: summarizeUpdateInfo(
          (event ?? this.state.updateInfo ?? {}) as MinimalUpdateInfo
        ),
        progress: { percent: 100 },
        checkedAt: this.state.checkedAt,
        error: undefined
      })
    })

    this.updater.on('error', (error) => {
      this.handleError(error)
    })
  }

  private handleError(error: unknown): void {
    const message = this.errorMessage(error)
    log.error('[updates]', message)

    if (this.activeCheckMode === 'automatic') {
      this.setState({ status: 'idle' })
      return
    }

    this.setState({
      ...this.state,
      status: 'error',
      error: message
    })
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

  private setState(state: UpdateState): void {
    this.state = state
    this.broadcast()
  }

  private broadcast(): void {
    for (const contents of webContents.getAllWebContents()) {
      if (!contents.isDestroyed()) {
        contents.send(IPC_CHANNELS.updates.state, this.state)
      }
    }
  }
}
