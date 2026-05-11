import log from 'electron-log/main';
import type { UpdateState } from '../../shared/types';

export const CHECK_TIMEOUT_MS = 10_000;
export const PROGRESS_STALL_MS = 30_000;
export const ERROR_AUTO_CLOSE_DELAY_MS = 3_000;

export type OrchestratorOutcome =
  | 'no-update'
  | 'continued-without-update'
  | 'installing'
  | 'failed';

export type SplashHandle = {
  isDestroyed: () => boolean;
  close: () => void;
  sendShowContinueLink: () => void;
  sendAutoCloseSoon: (delayMs: number) => void;
};

export type UpdateServiceLike = {
  checkOnLaunch: () => Promise<unknown>;
  download: () => Promise<{ ok: boolean }>;
  retryDownload: () => Promise<{ ok: boolean }>;
  install: () => { ok: boolean; error?: { message: string } };
  onStateChange: (listener: (state: UpdateState) => void) => () => void;
};

export type LaunchUpdateOrchestratorOptions = {
  updateService: UpdateServiceLike;
  createSplash: () => SplashHandle;
  checkTimeoutMs?: number;
  progressStallMs?: number;
  errorAutoCloseDelayMs?: number;
};

export type LaunchUpdateController = {
  promise: Promise<OrchestratorOutcome>;
  continueWithoutUpdate: () => void;
};

export function runLaunchUpdateCheck(
  options: LaunchUpdateOrchestratorOptions
): LaunchUpdateController {
  const checkTimeoutMs = options.checkTimeoutMs ?? CHECK_TIMEOUT_MS;
  const progressStallMs = options.progressStallMs ?? PROGRESS_STALL_MS;
  const errorAutoCloseDelayMs = options.errorAutoCloseDelayMs ?? ERROR_AUTO_CLOSE_DELAY_MS;

  let resolve: (outcome: OrchestratorOutcome) => void = () => {};
  const promise = new Promise<OrchestratorOutcome>((res) => {
    resolve = res;
  });

  let splash: SplashHandle | null = null;
  let resolved = false;
  let checkTimer: NodeJS.Timeout | null = null;
  let stallTimer: NodeJS.Timeout | null = null;
  let autoCloseTimer: NodeJS.Timeout | null = null;
  let retryAttempted = false;
  let lastTransferred = -1;
  let unsubscribe: (() => void) | null = null;

  const clearTimer = (handle: NodeJS.Timeout | null): null => {
    if (handle) {
      clearTimeout(handle);
    }
    return null;
  };

  const clearAllTimers = (): void => {
    checkTimer = clearTimer(checkTimer);
    stallTimer = clearTimer(stallTimer);
    autoCloseTimer = clearTimer(autoCloseTimer);
  };

  const finish = (outcome: OrchestratorOutcome): void => {
    if (resolved) {
      return;
    }
    resolved = true;
    clearAllTimers();
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    if (outcome !== 'installing' && splash != null && !splash.isDestroyed()) {
      splash.close();
    }
    resolve(outcome);
  };

  const armStallTimer = (): void => {
    stallTimer = clearTimer(stallTimer);
    stallTimer = setTimeout(() => {
      if (splash != null) {
        splash.sendShowContinueLink();
      }
    }, progressStallMs);
  };

  const ensureSplash = (): SplashHandle => {
    if (splash == null) {
      splash = options.createSplash();
    }
    return splash;
  };

  const handleAvailable = async (): Promise<void> => {
    checkTimer = clearTimer(checkTimer);
    ensureSplash();
    armStallTimer();
    const result = await options.updateService.download();
    if (!result.ok) {
      await handleDownloadError();
    }
  };

  const handleProgress = (state: UpdateState): void => {
    const transferred = state.progress?.transferred ?? 0;
    if (transferred !== lastTransferred) {
      lastTransferred = transferred;
      armStallTimer();
    }
  };

  const handleDownloaded = (): void => {
    const installResult = options.updateService.install();
    if (!installResult.ok) {
      log.error(
        '[launch-update] install() refused:',
        installResult.error?.message ?? 'unknown reason'
      );
      finish('failed');
      return;
    }
    finish('installing');
  };

  const scheduleAutoClose = (): void => {
    if (splash != null) {
      splash.sendAutoCloseSoon(errorAutoCloseDelayMs);
    }
    autoCloseTimer = setTimeout(() => {
      finish('failed');
    }, errorAutoCloseDelayMs);
  };

  const handleDownloadError = async (): Promise<void> => {
    if (retryAttempted) {
      scheduleAutoClose();
      return;
    }

    retryAttempted = true;
    if (splash != null) {
      splash.sendShowContinueLink();
    }
    const result = await options.updateService.retryDownload();
    if (!result.ok) {
      scheduleAutoClose();
    }
  };

  const onState = (state: UpdateState): void => {
    if (resolved) {
      return;
    }

    switch (state.status) {
      case 'available':
        void handleAvailable();
        break;
      case 'downloading':
        handleProgress(state);
        break;
      case 'downloaded':
        handleDownloaded();
        break;
      case 'not_available':
      case 'unavailable':
        finish('no-update');
        break;
      case 'error':
        void handleDownloadError();
        break;
      default:
        break;
    }
  };

  unsubscribe = options.updateService.onStateChange(onState);

  checkTimer = setTimeout(() => {
    log.info('[launch-update] check timed out');
    finish('no-update');
  }, checkTimeoutMs);

  void options.updateService.checkOnLaunch().catch((error) => {
    log.error('[launch-update] checkOnLaunch threw:', error);
    finish('no-update');
  });

  return {
    promise,
    continueWithoutUpdate: () => finish('continued-without-update')
  };
}
