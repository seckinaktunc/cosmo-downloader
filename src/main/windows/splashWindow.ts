import { join } from 'path';
import { BrowserWindow } from 'electron';
import { is } from '@electron-toolkit/utils';
import { APP_ICON, APP_NAME } from '../appIdentity';
import type { AppSettings, SplashEvent } from '../../shared/types';
import { IPC_CHANNELS } from '../../shared/ipc';

export function isSplashEligible(settings: AppSettings, isPackaged: boolean): boolean {
  return isPackaged && settings.automaticUpdates;
}

export function createSplashWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 320,
    height: 296,
    title: APP_NAME,
    show: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    frame: false,
    center: true,
    skipTaskbar: false,
    icon: APP_ICON,
    backgroundColor: '#000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.on('ready-to-show', () => {
    window.show();
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/splash.html`);
  } else {
    window.loadFile(join(__dirname, '../renderer/splash.html'));
  }

  return window;
}

export function sendSplashEvent(window: BrowserWindow, event: SplashEvent): void {
  if (window.isDestroyed()) {
    return;
  }

  window.webContents.send(IPC_CHANNELS.updates.splashEvent, event);
}
