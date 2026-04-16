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
  queue: {
    get: 'queue:get',
    add: 'queue:add',
    start: 'queue:start',
    pause: 'queue:pause',
    resume: 'queue:resume',
    cancelActive: 'queue:cancel-active',
    remove: 'queue:remove',
    removeMany: 'queue:remove-many',
    reorder: 'queue:reorder',
    move: 'queue:move',
    moveMany: 'queue:move-many',
    updateExportSettings: 'queue:update-export-settings',
    retry: 'queue:retry',
    clear: 'queue:clear',
    snapshot: 'queue:snapshot'
  },
  history: {
    get: 'history:get',
    remove: 'history:remove',
    removeMany: 'history:remove-many',
    clear: 'history:clear',
    requeue: 'history:requeue',
    openOutput: 'history:open-output',
    copySource: 'history:copy-source',
    changed: 'history:changed'
  },
  window: {
    action: 'window:action',
    setAlwaysOnTop: 'window:set-always-on-top'
  }
} as const
