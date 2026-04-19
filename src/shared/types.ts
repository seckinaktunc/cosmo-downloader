export type IpcErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNSUPPORTED_URL'
  | 'BINARY_MISSING'
  | 'PROCESS_FAILED'
  | 'CANCELLED'
  | 'BUSY'
  | 'NOT_FOUND'
  | 'UNKNOWN'

export type IpcError = {
  code: IpcErrorCode
  message: string
  details?: string
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: IpcError }

export type DownloadStage =
  | 'idle'
  | 'validating'
  | 'fetching_metadata'
  | 'ready'
  | 'downloading'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type OutputFormat = 'mp4' | 'mkv' | 'webm' | 'mp3' | 'wav'
export type VideoCodec = 'auto' | 'av1' | 'vp9' | 'h265' | 'h264'
export type AudioCodec = 'auto' | 'opus' | 'vorbis' | 'aac' | 'm4a' | 'mp3'
export type CookieBrowser =
  | 'none'
  | 'chrome'
  | 'chromium'
  | 'edge'
  | 'firefox'
  | 'brave'
  | 'opera'
  | 'vivaldi'
  | 'safari'

export type CookieBrowserOption = {
  id: CookieBrowser
  label: string
  exists: boolean
}

export type AppSettings = {
  hardwareAcceleration: boolean
  automaticUpdates: boolean
  alwaysAskDownloadLocation: boolean
  createFolderPerDownload: boolean
  defaultDownloadLocation: string
  lastDownloadDirectory?: string
  interfaceLanguage: string
  cookiesBrowser: CookieBrowser
  alwaysOnTop: boolean
}

export type SettingsUpdate = Partial<AppSettings>

export type VideoFormat = {
  id: string
  extension: string
  container?: string
  resolution?: string
  width?: number
  height?: number
  fps?: number
  videoCodec?: string
  audioCodec?: string
  audioBitrate?: number
  filesize?: number
  filesizeApprox?: number
  protocol?: string
}

export type VideoMetadata = {
  requestId: string
  url: string
  webpageUrl?: string
  platform?: string
  title: string
  thumbnail?: string
  description?: string
  uploader?: string
  uploaderUrl?: string
  duration?: number
  maxResolution?: number
  containers: string[]
  videoCodecs: string[]
  audioCodecs: string[]
  fpsOptions: number[]
  formats: VideoFormat[]
}

export type ExportSettings = {
  outputFormat: OutputFormat
  resolution: number | 'auto'
  videoBitrate: number | 'auto'
  audioBitrate: number | 'auto'
  frameRate: number | 'auto'
  videoCodec: VideoCodec
  audioCodec: AudioCodec
  savePath?: string
}

export type DownloadStartRequest = {
  metadata: VideoMetadata
  exportSettings: ExportSettings
  settings: AppSettings
  outputPath?: string
}

export type FetchMetadataRequest = {
  requestId: string
  url: string
  settings: AppSettings
}

export type CancelMetadataRequest = {
  requestId: string
}

export type DownloadProgress = {
  stage: DownloadStage
  stageLabel: string
  percentage?: number
  speed?: string
  eta?: string
  downloadedBytes?: number
  totalBytes?: number
  outputPath?: string
  logPath?: string
  message?: string
  queuedItemId?: string
  queueIndex?: number
  queueTotal?: number
}

export type AppEnvironment = {
  platform: NodeJS.Platform
  isPackaged: boolean
  version: string
  hardwareAccelerationAvailable: boolean
}

export type WindowAction = 'minimize' | 'toggleMaximize' | 'close'

export type QueueItemStatus = 'pending' | 'active' | 'paused' | 'completed' | 'failed' | 'cancelled'

export type QueueItem = {
  id: string
  metadata: VideoMetadata
  exportSettings: ExportSettings
  settings: AppSettings
  status: QueueItemStatus
  createdAt: string
  updatedAt: string
  outputPath?: string
  requestedOutputPath?: string
  logPath?: string
  error?: string
  progress?: DownloadProgress
  historyEntryId?: string
}

export type QueueSnapshot = {
  items: QueueItem[]
  activeItemId?: string
  paused: boolean
}

export type QueueAddRequest = DownloadStartRequest

export type QueueReorderRequest = {
  itemId: string
  direction: 'up' | 'down'
}

export type QueueMoveRequest = {
  itemId: string
  targetIndex: number
}

export type QueueMoveManyRequest = {
  itemIds: string[]
  targetIndex: number
}

export type QueueExportSettingsUpdateRequest = {
  itemId: string
  exportSettings: ExportSettings
}

export type QueueBulkRequest = {
  itemIds: string[]
}

export type QueueItemRequest = {
  itemId: string
}

export type DownloadHistoryStatus = 'started' | 'completed' | 'failed' | 'cancelled'

export type DownloadHistoryEntry = {
  id: string
  queueItemId?: string
  metadata: VideoMetadata
  exportSettings: ExportSettings
  settings: AppSettings
  status: DownloadHistoryStatus
  createdAt: string
  updatedAt: string
  outputPath?: string
  logPath?: string
  error?: string
}

export type HistoryItemRequest = {
  entryId: string
}

export type HistoryBulkRequest = {
  entryIds: string[]
}

export type ChooseOutputPathRequest = {
  title: string
  outputFormat: OutputFormat
  currentPath?: string
  defaultDirectory?: string
}

export type ChooseOutputPathResult = {
  filePath: string
  directory: string
}

export type ThumbnailRequest = {
  url: string
  title?: string
}

export type OpenPathRequest = {
  path: string
}
