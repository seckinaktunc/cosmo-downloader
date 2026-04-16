import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc'
import type {
  AppEnvironment,
  CancelMetadataRequest,
  HistoryBulkRequest,
  HistoryItemRequest,
  QueueAddRequest,
  QueueBulkRequest,
  QueueExportSettingsUpdateRequest,
  QueueItemRequest,
  QueueMoveManyRequest,
  QueueMoveRequest,
  QueueReorderRequest,
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
import { HistoryService } from '../services/historyService'
import { QueueService } from '../services/queueService'
import { fail, ok } from '../utils/ipcResult'

export function registerIpcHandlers(): void {
  const settingsService = new SettingsService()
  const binaryService = new BinaryService()
  const metadataService = new VideoMetadataService(binaryService)
  const downloadService = new DownloadService(binaryService)
  const historyService = new HistoryService()
  const queueService = new QueueService(downloadService, historyService)

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

  ipcMain.handle(IPC_CHANNELS.queue.get, () => ok(queueService.getSnapshot()))

  ipcMain.handle(IPC_CHANNELS.queue.add, (_event, request: QueueAddRequest) =>
    queueService.add(request)
  )

  ipcMain.handle(IPC_CHANNELS.queue.start, (event) => queueService.start(event.sender))

  ipcMain.handle(IPC_CHANNELS.queue.pause, () => queueService.pause())

  ipcMain.handle(IPC_CHANNELS.queue.resume, (event) => queueService.resume(event.sender))

  ipcMain.handle(IPC_CHANNELS.queue.cancelActive, () => queueService.cancelActive())

  ipcMain.handle(IPC_CHANNELS.queue.remove, (_event, request: QueueItemRequest) =>
    queueService.remove(request.itemId)
  )

  ipcMain.handle(IPC_CHANNELS.queue.removeMany, (_event, request: QueueBulkRequest) =>
    queueService.removeMany(request)
  )

  ipcMain.handle(IPC_CHANNELS.queue.reorder, (_event, request: QueueReorderRequest) =>
    queueService.reorder(request)
  )

  ipcMain.handle(IPC_CHANNELS.queue.move, (_event, request: QueueMoveRequest) =>
    queueService.move(request)
  )

  ipcMain.handle(IPC_CHANNELS.queue.moveMany, (_event, request: QueueMoveManyRequest) =>
    queueService.moveMany(request)
  )

  ipcMain.handle(
    IPC_CHANNELS.queue.updateExportSettings,
    (_event, request: QueueExportSettingsUpdateRequest) =>
      queueService.updateExportSettings(request)
  )

  ipcMain.handle(IPC_CHANNELS.queue.retry, (_event, request: QueueItemRequest) =>
    queueService.retry(request.itemId)
  )

  ipcMain.handle(IPC_CHANNELS.queue.clear, () => queueService.clear())

  ipcMain.handle(IPC_CHANNELS.history.get, () => ok(historyService.get()))

  ipcMain.handle(IPC_CHANNELS.history.remove, (_event, request: HistoryItemRequest) =>
    ok(historyService.remove(request.entryId))
  )

  ipcMain.handle(IPC_CHANNELS.history.removeMany, (_event, request: HistoryBulkRequest) =>
    ok(historyService.removeMany(request.entryIds))
  )

  ipcMain.handle(IPC_CHANNELS.history.clear, () => ok(historyService.clear()))

  ipcMain.handle(IPC_CHANNELS.history.requeue, (_event, request: HistoryItemRequest) => {
    const entry = historyService.find(request.entryId)
    if (!entry) {
      return fail('NOT_FOUND', 'History entry not found.')
    }

    return queueService.addFromHistory(entry)
  })

  ipcMain.handle(IPC_CHANNELS.history.openOutput, (_event, request: HistoryItemRequest) => {
    return historyService.openOutput(request.entryId)
      ? ok(null)
      : fail('NOT_FOUND', 'Downloaded file was not found.')
  })

  ipcMain.handle(IPC_CHANNELS.history.copySource, (_event, request: HistoryItemRequest) => {
    return historyService.copySource(request.entryId)
      ? ok(null)
      : fail('NOT_FOUND', 'Source URL was not found.')
  })

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

  ipcMain.handle(IPC_CHANNELS.window.setAlwaysOnTop, (event, enabled: boolean) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window == null) {
      return fail('NOT_FOUND', 'Window not found.')
    }

    window.setAlwaysOnTop(enabled)
    return ok(null)
  })
}
