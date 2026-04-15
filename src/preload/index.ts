import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc'
import type {
  AppEnvironment,
  AppSettings,
  CancelMetadataRequest,
  CookieBrowserOption,
  DownloadProgress,
  DownloadStartRequest,
  FetchMetadataRequest,
  IpcResult,
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
  window: {
    minimize: () => Promise<IpcResult<null>>
    toggleMaximize: () => Promise<IpcResult<null>>
    close: () => Promise<IpcResult<null>>
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
  window: {
    minimize: () => windowAction('minimize'),
    toggleMaximize: () => windowAction('toggleMaximize'),
    close: () => windowAction('close')
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('cosmo', api)
} else {
  ;(window as Window & typeof globalThis & { cosmo: CosmoApi }).cosmo = api
}
