import type { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc';
import type { SplashEvent, UpdateState } from '../../shared/types';

type PreviewMode = 'normal' | 'stalled' | 'error';

const TOTAL_BYTES = 64_600_000;
const TICK_MS = 200;
const BYTES_PER_TICK = 50_000;

function resolveMode(): PreviewMode {
  const raw = (process.env.COSMO_PREVIEW_SPLASH ?? '').toLowerCase();
  if (raw === 'stalled') return 'stalled';
  if (raw === 'error') return 'error';
  return 'normal';
}

function send(window: BrowserWindow, channel: string, payload: UpdateState | SplashEvent): void {
  if (window.isDestroyed()) {
    return;
  }
  window.webContents.send(channel, payload);
}

function emitState(window: BrowserWindow, state: UpdateState): void {
  send(window, IPC_CHANNELS.updates.state, state);
}

function emitSplash(window: BrowserWindow, event: SplashEvent): void {
  send(window, IPC_CHANNELS.updates.splashEvent, event);
}

export function isSplashPreviewEnabled(): boolean {
  return Boolean(process.env.COSMO_PREVIEW_SPLASH);
}

export function startSplashPreview(window: BrowserWindow): void {
  const mode = resolveMode();
  const version = '1.0.99';
  let transferred = 0;

  const startDownload = (): void => {
    transferred = 0;
    emitState(window, {
      status: 'downloading',
      updateInfo: { version },
      progress: { percent: 0, transferred: 0, total: TOTAL_BYTES }
    });
  };

  window.webContents.once('did-finish-load', () => {
    startDownload();

    if (mode === 'normal') {
      setTimeout(() => {
        emitSplash(window, { kind: 'show-continue-link' });
      }, 30_000);
    }

    if (mode === 'stalled') {
      setTimeout(() => {
        emitSplash(window, { kind: 'show-continue-link' });
      }, 600);
      return;
    }

    if (mode === 'error') {
      setTimeout(() => {
        emitSplash(window, { kind: 'show-continue-link' });
      }, 600);
      setTimeout(() => {
        emitSplash(window, { kind: 'auto-close-soon', reason: 'error', delayMs: 3000 });
      }, 1500);
      return;
    }

    const interval = setInterval(() => {
      transferred = Math.min(TOTAL_BYTES, transferred + BYTES_PER_TICK);
      const percent = (transferred / TOTAL_BYTES) * 100;
      emitState(window, {
        status: 'downloading',
        updateInfo: { version },
        progress: {
          percent,
          transferred,
          total: TOTAL_BYTES,
          bytesPerSecond: BYTES_PER_TICK * (1000 / TICK_MS)
        }
      });

      if (transferred >= TOTAL_BYTES) {
        clearInterval(interval);
        setTimeout(() => {
          emitState(window, {
            status: 'downloaded',
            updateInfo: { version },
            progress: { percent: 100 }
          });
        }, 400);
        setTimeout(() => {
          // loop the preview so the developer keeps seeing it
          startDownload();
          const next = setInterval(() => {
            transferred = Math.min(TOTAL_BYTES, transferred + BYTES_PER_TICK);
            const p = (transferred / TOTAL_BYTES) * 100;
            emitState(window, {
              status: 'downloading',
              updateInfo: { version },
              progress: { percent: p, transferred, total: TOTAL_BYTES }
            });
            if (transferred >= TOTAL_BYTES) {
              clearInterval(next);
            }
          }, TICK_MS);
        }, 2500);
      }
    }, TICK_MS);
  });
}
