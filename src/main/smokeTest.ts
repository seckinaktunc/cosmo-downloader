import type { BrowserWindow, WebContents } from 'electron';

export const SMOKE_TEST_EXIT_DELAY_MS = 250;

type AppLike = {
  exit: (exitCode?: number) => void;
};

type SmokeTestWindow = Pick<BrowserWindow, 'on'> & {
  webContents: Pick<WebContents, 'on' | 'once'>;
};

export function attachSmokeTestHandlers(
  app: AppLike,
  mainWindow: SmokeTestWindow,
  exitDelayMs = SMOKE_TEST_EXIT_DELAY_MS
): void {
  let settled = false;

  const finishSmokeTest = (exitCode: number, reason?: string): void => {
    if (settled) {
      return;
    }

    settled = true;
    if (reason) {
      console.error(`[smoke-test] ${reason}`);
    }
    app.exit(exitCode);
  };

  mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
    finishSmokeTest(1, `renderer failed to load (${errorCode}): ${errorDescription}`);
  });
  mainWindow.webContents.on('render-process-gone', (_, details) => {
    finishSmokeTest(1, `renderer process exited: ${details.reason}`);
  });
  mainWindow.on('unresponsive', () => {
    finishSmokeTest(1, 'main window became unresponsive');
  });
  mainWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => finishSmokeTest(0), exitDelayMs);
  });
}
