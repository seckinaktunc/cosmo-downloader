import { app, shell, BrowserWindow, type BrowserWindowConstructorOptions } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { APP_ICON, APP_ID, APP_NAME } from './appIdentity';
import { registerIpcHandlers } from './ipc/registerIpc';
import {
  readStartupAlwaysOnTop,
  readStartupHardwareAcceleration
} from './services/settingsService';
import { attachSmokeTestHandlers } from './smokeTest';
import { createSplashWindow, isSplashEligible, sendSplashEvent } from './windows/splashWindow';
import { runLaunchUpdateCheck } from './services/launchUpdateOrchestrator';
import { setActiveSplashController } from './services/splashController';
import { isSplashPreviewEnabled, startSplashPreview } from './services/splashPreview';
import { notifyOfUpdate, shouldNotifyOfUpdate } from './services/updateNotifier';
import type { SettingsService } from './services/settingsService';
import type { UpdateService } from './services/updateService';

const isSmokeTest = process.env.COSMO_SMOKE_TEST === '1';

app.setName(APP_NAME);

if (!readStartupHardwareAcceleration()) {
  app.disableHardwareAcceleration();
}

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const target = mainWindow ?? splashWindow;
    if (!target || target.isDestroyed()) {
      return;
    }
    if (target.isMinimized()) {
      target.restore();
    }
    target.focus();
  });
}

function getWindowChromeOptions(): Pick<
  BrowserWindowConstructorOptions,
  'titleBarStyle' | 'titleBarOverlay' | 'trafficLightPosition'
> {
  if (process.platform === 'darwin') {
    return {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 26 }
    };
  }

  return {
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: '#ffffff',
      height: 64
    }
  };
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1180,
    height: 825,
    minWidth: 1180,
    minHeight: 825,
    title: APP_NAME,
    show: false,
    alwaysOnTop: readStartupAlwaysOnTop(),
    autoHideMenuBar: true,
    ...getWindowChromeOptions(),
    ...(process.platform !== 'darwin' ? { icon: APP_ICON } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (isSmokeTest) {
    attachSmokeTestHandlers(app, window);
  } else {
    window.on('ready-to-show', () => {
      window.show();
    });
  }

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'));
  }

  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  return window;
}

function maybeNotifyOfUpdate(settingsService: SettingsService): void {
  const settings = settingsService.get();
  const currentVersion = app.getVersion();

  if (shouldNotifyOfUpdate(currentVersion, settings.lastNotifiedAppVersion)) {
    notifyOfUpdate(currentVersion, settings.interfaceLanguage);
  }

  if (settings.lastNotifiedAppVersion !== currentVersion) {
    void settingsService.update({ lastNotifiedAppVersion: currentVersion });
  }
}

async function runStartupUpdateFlow(
  settingsService: SettingsService,
  updateService: UpdateService
): Promise<void> {
  if (!isSplashEligible(settingsService.get(), app.isPackaged)) {
    return;
  }

  const controller = runLaunchUpdateCheck({
    updateService: {
      checkOnLaunch: () => updateService.checkOnLaunch(),
      download: () => updateService.download(),
      retryDownload: () => updateService.retryDownload(),
      install: () => updateService.install(),
      onStateChange: (listener) => updateService.onStateChange(listener)
    },
    createSplash: () => {
      splashWindow = createSplashWindow();
      const handle = splashWindow;
      return {
        isDestroyed: () => handle.isDestroyed(),
        close: () => {
          if (!handle.isDestroyed()) {
            handle.close();
          }
        },
        sendShowContinueLink: () => sendSplashEvent(handle, { kind: 'show-continue-link' }),
        sendAutoCloseSoon: (delayMs) =>
          sendSplashEvent(handle, { kind: 'auto-close-soon', reason: 'error', delayMs })
      };
    }
  });

  setActiveSplashController(controller);

  try {
    const outcome = await controller.promise;
    if (outcome === 'installing') {
      // app is quitting to install — do not create the main window
      return;
    }
  } finally {
    setActiveSplashController(null);
    splashWindow = null;
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId(APP_ID);

  if (process.platform === 'darwin' && is.dev) {
    app.dock?.setIcon(APP_ICON);
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  const services = registerIpcHandlers();

  if (isSplashPreviewEnabled()) {
    splashWindow = createSplashWindow();
    startSplashPreview(splashWindow);
    splashWindow.on('closed', () => {
      splashWindow = null;
    });
    return;
  }

  await runStartupUpdateFlow(services.settingsService, services.updateService);

  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow();
    mainWindow.once('ready-to-show', () => {
      maybeNotifyOfUpdate(services.settingsService);
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
