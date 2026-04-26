import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron';
import { existsSync, statSync } from 'fs';
import { dirname, join, parse } from 'path';
import { IPC_CHANNELS } from '../../shared/ipc';
import type {
  AppEnvironment,
  CancelMetadataRequest,
  ChooseOutputPathRequest,
  ChooseOutputPathResult,
  HistoryBulkRequest,
  HistoryItemRequest,
  OpenPathRequest,
  QueueAddRequest,
  QueueBulkRequest,
  QueueExportSettingsUpdateRequest,
  QueueItemRequest,
  QueueMoveManyRequest,
  QueueMoveRequest,
  QueueReorderRequest,
  DownloadLogReadRequest,
  DownloadStartRequest,
  FetchMetadataRequest,
  RecordFetchHistoryRequest,
  SettingsUpdate,
  ThumbnailRequest,
  WindowAction
} from '../../shared/types';
import { detectCookieBrowsers } from '../services/browserDetector';
import { SettingsService } from '../services/settingsService';
import { BinaryService } from '../services/binaryService';
import { VideoMetadataService } from '../services/videoMetadataService';
import { DownloadService } from '../services/downloadService';
import { HistoryService } from '../services/historyService';
import { QueueService } from '../services/queueService';
import { UpdateService } from '../services/updateService';
import { createUniquePath } from '../services/filename';
import { readDownloadLogTail } from '../services/logService';
import {
  copyThumbnailImage,
  downloadThumbnail,
  openThumbnailExternal
} from '../services/thumbnailService';
import { fail, ok } from '../utils/ipcResult';

function getOpenablePath(targetPath: string): string | null {
  if (existsSync(targetPath) && statSync(targetPath).isDirectory()) {
    return targetPath;
  }

  const parent = dirname(targetPath);
  return existsSync(parent) ? parent : null;
}

export function registerIpcHandlers(): void {
  const settingsService = new SettingsService();
  const binaryService = new BinaryService();
  const metadataService = new VideoMetadataService(binaryService);
  const downloadService = new DownloadService(binaryService);
  const historyService = new HistoryService();
  const queueService = new QueueService(downloadService, historyService);
  const updateService = new UpdateService(settingsService, {
    isMediaBusy: () => downloadService.isActive() || queueService.hasActiveItem()
  });

  ipcMain.handle(IPC_CHANNELS.app.environment, () => {
    const environment: AppEnvironment = {
      platform: process.platform,
      isPackaged: app.isPackaged,
      version: app.getVersion(),
      hardwareAccelerationAvailable: true
    };
    return ok(environment);
  });

  ipcMain.handle(IPC_CHANNELS.settings.get, () => ok(settingsService.get()));

  ipcMain.handle(IPC_CHANNELS.settings.update, (_event, update: SettingsUpdate) => {
    const settings = settingsService.update(update);
    if (update.automaticUpdates === true) {
      void updateService.checkAutomatic();
    }
    return ok(settings);
  });

  ipcMain.handle(IPC_CHANNELS.settings.chooseDownloadDirectory, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose download location',
      properties: ['openDirectory', 'createDirectory']
    });

    return ok(result.canceled ? null : result.filePaths[0]);
  });

  ipcMain.handle(
    IPC_CHANNELS.settings.chooseOutputPath,
    async (_event, request: ChooseOutputPathRequest) => {
      const extension = request.outputFormat;
      const currentPath = request.currentPath?.trim();
      const defaultDirectory =
        request.defaultDirectory?.trim() ||
        settingsService.get().lastDownloadDirectory ||
        settingsService.get().defaultDownloadLocation ||
        app.getPath('downloads');
      const defaultPath = currentPath
        ? createUniquePath(parse(currentPath).dir, parse(currentPath).name, extension)
        : createUniquePath(defaultDirectory, request.title || 'video', extension);

      const result = await dialog.showSaveDialog({
        title: 'Choose download file',
        defaultPath,
        filters: [{ name: extension.toUpperCase(), extensions: [extension] }]
      });

      if (result.canceled || !result.filePath) {
        return ok(null);
      }

      const data: ChooseOutputPathResult = {
        filePath: result.filePath,
        directory: dirname(result.filePath)
      };
      return ok(data);
    }
  );

  ipcMain.handle(IPC_CHANNELS.clipboard.readText, () => ok(clipboard.readText()));

  ipcMain.handle(IPC_CHANNELS.clipboard.writeText, (_event, text: string) => {
    clipboard.writeText(text);
    return ok(null);
  });

  ipcMain.handle(IPC_CHANNELS.thumbnail.download, (_event, request: ThumbnailRequest) =>
    downloadThumbnail(request)
  );

  ipcMain.handle(IPC_CHANNELS.thumbnail.copyImage, (_event, request: ThumbnailRequest) =>
    copyThumbnailImage(request)
  );

  ipcMain.handle(IPC_CHANNELS.thumbnail.openExternal, (_event, request: ThumbnailRequest) =>
    openThumbnailExternal(request)
  );

  ipcMain.handle(IPC_CHANNELS.shell.openPath, async (_event, request: OpenPathRequest) => {
    if (existsSync(request.path) && statSync(request.path).isFile()) {
      shell.showItemInFolder(request.path);
      return ok(null);
    }

    const openablePath = getOpenablePath(request.path);
    if (!openablePath) {
      return fail('NOT_FOUND', 'Path was not found.');
    }

    const error = await shell.openPath(openablePath);
    return error ? fail('PROCESS_FAILED', error) : ok(null);
  });

  ipcMain.handle(IPC_CHANNELS.system.detectCookieBrowsers, () => ok(detectCookieBrowsers()));

  ipcMain.handle(IPC_CHANNELS.video.fetchMetadata, (_event, request: FetchMetadataRequest) =>
    metadataService.fetch(request.requestId, request.url, request.settings)
  );

  ipcMain.handle(IPC_CHANNELS.video.cancelMetadata, (_event, request: CancelMetadataRequest) => {
    metadataService.cancel(request.requestId);
    return ok(null);
  });

  ipcMain.handle(IPC_CHANNELS.download.start, (event, request: DownloadStartRequest) =>
    downloadService.start(event.sender, request)
  );

  ipcMain.handle(IPC_CHANNELS.download.cancel, () => downloadService.cancel());

  ipcMain.handle(IPC_CHANNELS.logs.read, (_event, request: DownloadLogReadRequest) =>
    readDownloadLogTail(join(app.getPath('userData'), 'logs'), request)
  );

  ipcMain.handle(IPC_CHANNELS.queue.get, () => ok(queueService.getSnapshot()));

  ipcMain.handle(IPC_CHANNELS.queue.add, (_event, request: QueueAddRequest) =>
    queueService.add(request)
  );

  ipcMain.handle(IPC_CHANNELS.queue.start, (event) => queueService.start(event.sender));

  ipcMain.handle(IPC_CHANNELS.queue.pause, () => queueService.pause());

  ipcMain.handle(IPC_CHANNELS.queue.resume, (event) => queueService.resume(event.sender));

  ipcMain.handle(IPC_CHANNELS.queue.cancelActive, () => queueService.cancelActive());

  ipcMain.handle(IPC_CHANNELS.queue.remove, (_event, request: QueueItemRequest) =>
    queueService.remove(request.itemId)
  );

  ipcMain.handle(IPC_CHANNELS.queue.removeMany, (_event, request: QueueBulkRequest) =>
    queueService.removeMany(request)
  );

  ipcMain.handle(IPC_CHANNELS.queue.reorder, (_event, request: QueueReorderRequest) =>
    queueService.reorder(request)
  );

  ipcMain.handle(IPC_CHANNELS.queue.move, (_event, request: QueueMoveRequest) =>
    queueService.move(request)
  );

  ipcMain.handle(IPC_CHANNELS.queue.moveMany, (_event, request: QueueMoveManyRequest) =>
    queueService.moveMany(request)
  );

  ipcMain.handle(
    IPC_CHANNELS.queue.updateExportSettings,
    (_event, request: QueueExportSettingsUpdateRequest) =>
      queueService.updateExportSettings(request)
  );

  ipcMain.handle(IPC_CHANNELS.queue.retry, (_event, request: QueueItemRequest) =>
    queueService.retry(request.itemId)
  );

  ipcMain.handle(IPC_CHANNELS.queue.clear, () => queueService.clear());

  ipcMain.handle(IPC_CHANNELS.history.get, () => ok(historyService.get()));

  ipcMain.handle(IPC_CHANNELS.history.remove, (_event, request: HistoryItemRequest) =>
    ok(historyService.remove(request.entryId))
  );

  ipcMain.handle(IPC_CHANNELS.history.removeMany, (_event, request: HistoryBulkRequest) =>
    ok(historyService.removeMany(request.entryIds))
  );

  ipcMain.handle(IPC_CHANNELS.history.clear, () => ok(historyService.clear()));

  ipcMain.handle(IPC_CHANNELS.history.recordFetch, (_event, request: RecordFetchHistoryRequest) =>
    ok(historyService.recordFetch(request))
  );

  ipcMain.handle(IPC_CHANNELS.history.requeue, (_event, request: HistoryItemRequest) => {
    const entry = historyService.find(request.entryId);
    if (!entry) {
      return fail('NOT_FOUND', 'History entry not found.');
    }

    if (entry.status === 'fetch_failed') {
      return fail('VALIDATION_ERROR', 'Failed fetch entries cannot be queued.');
    }

    return queueService.addFromHistory(entry);
  });

  ipcMain.handle(IPC_CHANNELS.history.openOutput, (_event, request: HistoryItemRequest) => {
    return historyService.openOutput(request.entryId)
      ? ok(null)
      : fail('NOT_FOUND', 'Downloaded file was not found.');
  });

  ipcMain.handle(IPC_CHANNELS.history.openMedia, async (_event, request: HistoryItemRequest) => {
    return (await historyService.openMedia(request.entryId))
      ? ok(null)
      : fail('NOT_FOUND', 'Downloaded file was not found.');
  });

  ipcMain.handle(IPC_CHANNELS.history.openFolder, async (_event, request: HistoryItemRequest) => {
    return (await historyService.openFolder(request.entryId))
      ? ok(null)
      : fail('NOT_FOUND', 'Downloaded file was not found.');
  });

  ipcMain.handle(IPC_CHANNELS.history.copySource, (_event, request: HistoryItemRequest) => {
    return historyService.copySource(request.entryId)
      ? ok(null)
      : fail('NOT_FOUND', 'Source URL was not found.');
  });

  ipcMain.handle(IPC_CHANNELS.updates.getState, () => ok(updateService.getState()));

  ipcMain.handle(IPC_CHANNELS.updates.checkNow, () => updateService.checkNow());

  ipcMain.handle(IPC_CHANNELS.updates.download, () => updateService.download());

  ipcMain.handle(IPC_CHANNELS.updates.install, () => updateService.install());

  ipcMain.handle(IPC_CHANNELS.window.action, (event, action: WindowAction) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window == null) {
      return fail('NOT_FOUND', 'Window not found.');
    }

    if (action === 'minimize') {
      window.minimize();
    } else if (action === 'toggleMaximize') {
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
    } else {
      window.close();
    }

    return ok(null);
  });

  ipcMain.handle(IPC_CHANNELS.window.setAlwaysOnTop, (event, enabled: boolean) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window == null) {
      return fail('NOT_FOUND', 'Window not found.');
    }

    window.setAlwaysOnTop(enabled);
    return ok(null);
  });

  updateService.scheduleAutomaticChecks();
}
