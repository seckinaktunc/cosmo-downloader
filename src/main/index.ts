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

const isSmokeTest = process.env.COSMO_SMOKE_TEST === '1';

app.setName(APP_NAME);

if (!readStartupHardwareAcceleration()) {
  app.disableHardwareAcceleration();
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

function createWindow(): void {
  const mainWindow = new BrowserWindow({
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
    attachSmokeTestHandlers(app, mainWindow);
  } else {
    mainWindow.on('ready-to-show', () => {
      mainWindow.show();
    });
  }

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId(APP_ID);

  if (process.platform === 'darwin' && is.dev) {
    app.dock?.setIcon(APP_ICON);
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  registerIpcHandlers();

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
