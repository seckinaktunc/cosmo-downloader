export const IPC_CHANNELS = {
  app: {
    environment: 'app:environment'
  },
  settings: {
    get: 'settings:get',
    update: 'settings:update',
    chooseDownloadDirectory: 'settings:choose-download-directory'
  },
  system: {
    detectCookieBrowsers: 'system:detect-cookie-browsers'
  },
  video: {
    fetchMetadata: 'video:fetch-metadata',
    cancelMetadata: 'video:cancel-metadata'
  },
  download: {
    start: 'download:start',
    cancel: 'download:cancel',
    progress: 'download:progress',
    state: 'download:state'
  },
  window: {
    action: 'window:action'
  }
} as const
