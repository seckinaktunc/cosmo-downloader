import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc'
import type {
  AppEnvironment,
  CancelMetadataRequest,
  DownloadStartRequest,
  FetchMetadataRequest,
  SettingsUpdate,
  WindowAction
} from '../../shared/types'
import { detectCookieBrowsers } from '../services/browserDetector'
import { SettingsService } from '../services/settingsService'
import { BinaryService } from '../services/binaryService'
import { VideoMetadataService } from '../services/videoMetadataService'
import { DownloadService } from '../services/downloadService'
import { fail, ok } from '../utils/ipcResult'

export function registerIpcHandlers(): void {
  const settingsService = new SettingsService()
  const binaryService = new BinaryService()
  const metadataService = new VideoMetadataService(binaryService)
  const downloadService = new DownloadService(binaryService)

  ipcMain.handle(IPC_CHANNELS.app.environment, () => {
    const environment: AppEnvironment = {
      platform: process.platform,
      isPackaged: app.isPackaged,
      version: app.getVersion(),
      hardwareAccelerationAvailable: true
    }
    return ok(environment)
  })

  ipcMain.handle(IPC_CHANNELS.settings.get, () => ok(settingsService.get()))

  ipcMain.handle(IPC_CHANNELS.settings.update, (_event, update: SettingsUpdate) => {
    return ok(settingsService.update(update))
  })

  ipcMain.handle(IPC_CHANNELS.settings.chooseDownloadDirectory, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose download location',
      properties: ['openDirectory', 'createDirectory']
    })

    return ok(result.canceled ? null : result.filePaths[0])
  })

  ipcMain.handle(IPC_CHANNELS.system.detectCookieBrowsers, () => ok(detectCookieBrowsers()))

  ipcMain.handle(IPC_CHANNELS.video.fetchMetadata, (_event, request: FetchMetadataRequest) =>
    metadataService.fetch(request.requestId, request.url, request.settings)
  )

  ipcMain.handle(IPC_CHANNELS.video.cancelMetadata, (_event, request: CancelMetadataRequest) => {
    metadataService.cancel(request.requestId)
    return ok(null)
  })

  ipcMain.handle(IPC_CHANNELS.download.start, (event, request: DownloadStartRequest) =>
    downloadService.start(event.sender, request)
  )

  ipcMain.handle(IPC_CHANNELS.download.cancel, () => downloadService.cancel())

  ipcMain.handle(IPC_CHANNELS.window.action, (event, action: WindowAction) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window == null) {
      return fail('NOT_FOUND', 'Window not found.')
    }

    if (action === 'minimize') {
      window.minimize()
    } else if (action === 'toggleMaximize') {
      if (window.isMaximized()) {
        window.unmaximize()
      } else {
        window.maximize()
      }
    } else {
      window.close()
    }

    return ok(null)
  })
}
