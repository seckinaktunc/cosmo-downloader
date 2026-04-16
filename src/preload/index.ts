import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc'
import type {
  AppEnvironment,
  AppSettings,
  CancelMetadataRequest,
  CookieBrowserOption,
  DownloadHistoryEntry,
  DownloadProgress,
  DownloadStartRequest,
  FetchMetadataRequest,
  HistoryBulkRequest,
  HistoryItemRequest,
  IpcResult,
  QueueAddRequest,
  QueueBulkRequest,
  QueueExportSettingsUpdateRequest,
  QueueItemRequest,
  QueueMoveManyRequest,
  QueueMoveRequest,
  QueueReorderRequest,
  QueueSnapshot,
  SettingsUpdate,
  VideoMetadata,
  WindowAction
} from '../shared/types'

type Unsubscribe = () => void

export type CosmoApi = {
  app: {
    getEnvironment: () => Promise<IpcResult<AppEnvironment>>
  }
  settings: {
    get: () => Promise<IpcResult<AppSettings>>
    update: (update: SettingsUpdate) => Promise<IpcResult<AppSettings>>
    chooseDownloadDirectory: () => Promise<IpcResult<string | null>>
  }
  system: {
    detectCookieBrowsers: () => Promise<IpcResult<CookieBrowserOption[]>>
  }
  video: {
    fetchMetadata: (request: FetchMetadataRequest) => Promise<IpcResult<VideoMetadata>>
    cancelMetadata: (request: CancelMetadataRequest) => Promise<IpcResult<null>>
  }
  download: {
    start: (request: DownloadStartRequest) => Promise<IpcResult<DownloadProgress>>
    cancel: () => Promise<IpcResult<null>>
    onProgress: (listener: (progress: DownloadProgress) => void) => Unsubscribe
    onState: (listener: (progress: DownloadProgress) => void) => Unsubscribe
  }
  queue: {
    get: () => Promise<IpcResult<QueueSnapshot>>
    add: (request: QueueAddRequest) => Promise<IpcResult<QueueSnapshot>>
    start: () => Promise<IpcResult<QueueSnapshot>>
    pause: () => Promise<IpcResult<QueueSnapshot>>
    resume: () => Promise<IpcResult<QueueSnapshot>>
    cancelActive: () => Promise<IpcResult<QueueSnapshot>>
    remove: (request: QueueItemRequest) => Promise<IpcResult<QueueSnapshot>>
    removeMany: (request: QueueBulkRequest) => Promise<IpcResult<QueueSnapshot>>
    reorder: (request: QueueReorderRequest) => Promise<IpcResult<QueueSnapshot>>
    move: (request: QueueMoveRequest) => Promise<IpcResult<QueueSnapshot>>
    moveMany: (request: QueueMoveManyRequest) => Promise<IpcResult<QueueSnapshot>>
    updateExportSettings: (
      request: QueueExportSettingsUpdateRequest
    ) => Promise<IpcResult<QueueSnapshot>>
    retry: (request: QueueItemRequest) => Promise<IpcResult<QueueSnapshot>>
    clear: () => Promise<IpcResult<QueueSnapshot>>
    onSnapshot: (listener: (snapshot: QueueSnapshot) => void) => Unsubscribe
  }
  history: {
    get: () => Promise<IpcResult<DownloadHistoryEntry[]>>
    remove: (request: HistoryItemRequest) => Promise<IpcResult<DownloadHistoryEntry[]>>
    removeMany: (request: HistoryBulkRequest) => Promise<IpcResult<DownloadHistoryEntry[]>>
    clear: () => Promise<IpcResult<DownloadHistoryEntry[]>>
    requeue: (request: HistoryItemRequest) => Promise<IpcResult<QueueSnapshot>>
    openOutput: (request: HistoryItemRequest) => Promise<IpcResult<null>>
    copySource: (request: HistoryItemRequest) => Promise<IpcResult<null>>
    onChanged: (listener: (entries: DownloadHistoryEntry[]) => void) => Unsubscribe
  }
  window: {
    minimize: () => Promise<IpcResult<null>>
    toggleMaximize: () => Promise<IpcResult<null>>
    close: () => Promise<IpcResult<null>>
    setAlwaysOnTop: (enabled: boolean) => Promise<IpcResult<null>>
  }
}

function invoke<T>(channel: string, payload?: unknown): Promise<IpcResult<T>> {
  return ipcRenderer.invoke(channel, payload) as Promise<IpcResult<T>>
}

function subscribe<T>(channel: string, listener: (payload: T) => void): Unsubscribe {
  const wrapped = (_event: Electron.IpcRendererEvent, payload: T): void => listener(payload)
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.removeListener(channel, wrapped)
}

function windowAction(action: WindowAction): Promise<IpcResult<null>> {
  return invoke<null>(IPC_CHANNELS.window.action, action)
}

const api: CosmoApi = {
  app: {
    getEnvironment: () => invoke<AppEnvironment>(IPC_CHANNELS.app.environment)
  },
  settings: {
    get: () => invoke<AppSettings>(IPC_CHANNELS.settings.get),
    update: (update) => invoke<AppSettings>(IPC_CHANNELS.settings.update, update),
    chooseDownloadDirectory: () =>
      invoke<string | null>(IPC_CHANNELS.settings.chooseDownloadDirectory)
  },
  system: {
    detectCookieBrowsers: () =>
      invoke<CookieBrowserOption[]>(IPC_CHANNELS.system.detectCookieBrowsers)
  },
  video: {
    fetchMetadata: (request) => invoke<VideoMetadata>(IPC_CHANNELS.video.fetchMetadata, request),
    cancelMetadata: (request) => invoke<null>(IPC_CHANNELS.video.cancelMetadata, request)
  },
  download: {
    start: (request) => invoke<DownloadProgress>(IPC_CHANNELS.download.start, request),
    cancel: () => invoke<null>(IPC_CHANNELS.download.cancel),
    onProgress: (listener) => subscribe<DownloadProgress>(IPC_CHANNELS.download.progress, listener),
    onState: (listener) => subscribe<DownloadProgress>(IPC_CHANNELS.download.state, listener)
  },
  queue: {
    get: () => invoke<QueueSnapshot>(IPC_CHANNELS.queue.get),
    add: (request) => invoke<QueueSnapshot>(IPC_CHANNELS.queue.add, request),
    start: () => invoke<QueueSnapshot>(IPC_CHANNELS.queue.start),
    pause: () => invoke<QueueSnapshot>(IPC_CHANNELS.queue.pause),
    resume: () => invoke<QueueSnapshot>(IPC_CHANNELS.queue.resume),
    cancelActive: () => invoke<QueueSnapshot>(IPC_CHANNELS.queue.cancelActive),
    remove: (request) => invoke<QueueSnapshot>(IPC_CHANNELS.queue.remove, request),
    removeMany: (request) => invoke<QueueSnapshot>(IPC_CHANNELS.queue.removeMany, request),
    reorder: (request) => invoke<QueueSnapshot>(IPC_CHANNELS.queue.reorder, request),
    move: (request) => invoke<QueueSnapshot>(IPC_CHANNELS.queue.move, request),
    moveMany: (request) => invoke<QueueSnapshot>(IPC_CHANNELS.queue.moveMany, request),
    updateExportSettings: (request) =>
      invoke<QueueSnapshot>(IPC_CHANNELS.queue.updateExportSettings, request),
    retry: (request) => invoke<QueueSnapshot>(IPC_CHANNELS.queue.retry, request),
    clear: () => invoke<QueueSnapshot>(IPC_CHANNELS.queue.clear),
    onSnapshot: (listener) => subscribe<QueueSnapshot>(IPC_CHANNELS.queue.snapshot, listener)
  },
  history: {
    get: () => invoke<DownloadHistoryEntry[]>(IPC_CHANNELS.history.get),
    remove: (request) => invoke<DownloadHistoryEntry[]>(IPC_CHANNELS.history.remove, request),
    removeMany: (request) =>
      invoke<DownloadHistoryEntry[]>(IPC_CHANNELS.history.removeMany, request),
    clear: () => invoke<DownloadHistoryEntry[]>(IPC_CHANNELS.history.clear),
    requeue: (request) => invoke<QueueSnapshot>(IPC_CHANNELS.history.requeue, request),
    openOutput: (request) => invoke<null>(IPC_CHANNELS.history.openOutput, request),
    copySource: (request) => invoke<null>(IPC_CHANNELS.history.copySource, request),
    onChanged: (listener) =>
      subscribe<DownloadHistoryEntry[]>(IPC_CHANNELS.history.changed, listener)
  },
  window: {
    minimize: () => windowAction('minimize'),
    toggleMaximize: () => windowAction('toggleMaximize'),
    close: () => windowAction('close'),
    setAlwaysOnTop: (enabled) => invoke<null>(IPC_CHANNELS.window.setAlwaysOnTop, enabled)
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('cosmo', api)
} else {
  ;(window as Window & typeof globalThis & { cosmo: CosmoApi }).cosmo = api
}
