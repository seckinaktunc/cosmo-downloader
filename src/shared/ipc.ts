export const IPC_CHANNELS = {
  app: {
    environment: 'app:environment'
  },
  settings: {
    get: 'settings:get',
    update: 'settings:update',
    chooseDownloadDirectory: 'settings:choose-download-directory',
    chooseOutputPath: 'settings:choose-output-path'
  },
  clipboard: {
    readText: 'clipboard:read-text',
    writeText: 'clipboard:write-text'
  },
  thumbnail: {
    download: 'thumbnail:download',
    copyImage: 'thumbnail:copy-image',
    openExternal: 'thumbnail:open-external'
  },
  shell: {
    openPath: 'shell:open-path'
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
  logs: {
    read: 'logs:read',
    append: 'logs:append'
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
    openMedia: 'history:open-media',
    openFolder: 'history:open-folder',
    copySource: 'history:copy-source',
    changed: 'history:changed'
  },
  updates: {
    getState: 'updates:get-state',
    checkNow: 'updates:check-now',
    download: 'updates:download',
    install: 'updates:install',
    state: 'updates:state'
  },
  window: {
    action: 'window:action',
    setAlwaysOnTop: 'window:set-always-on-top'
  }
} as const
