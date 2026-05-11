import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

import type { UpdateState } from '@shared/types';
import { runLaunchUpdateCheck } from '@main/services/launchUpdateOrchestrator';

type Listener = (state: UpdateState) => void;

function ok<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

function fail(message: string): { ok: false; error: { message: string } } {
  return { ok: false, error: { message } };
}

type StubbedSplash = {
  close: ReturnType<typeof vi.fn>;
  isDestroyed: ReturnType<typeof vi.fn>;
  sendShowContinueLink: ReturnType<typeof vi.fn>;
  sendAutoCloseSoon: ReturnType<typeof vi.fn>;
};

function createSplashStub(): StubbedSplash {
  return {
    close: vi.fn(),
    isDestroyed: vi.fn(() => false),
    sendShowContinueLink: vi.fn(),
    sendAutoCloseSoon: vi.fn()
  };
}

function createService(): {
  listeners: Set<Listener>;
  emit: (state: UpdateState) => void;
  service: Parameters<typeof runLaunchUpdateCheck>[0]['updateService'];
  download: ReturnType<typeof vi.fn>;
  retryDownload: ReturnType<typeof vi.fn>;
  install: ReturnType<typeof vi.fn>;
  checkOnLaunch: ReturnType<typeof vi.fn>;
} {
  const listeners = new Set<Listener>();
  const checkOnLaunch = vi.fn(async () => ok({ status: 'checking' as const }));
  const download = vi.fn(async () => ok({ status: 'downloading' as const }));
  const retryDownload = vi.fn(async () => ok({ status: 'downloading' as const }));
  const install = vi.fn(() => ok({ status: 'downloaded' as const }));

  return {
    listeners,
    emit: (state) => {
      for (const l of listeners) {
        l(state);
      }
    },
    service: {
      checkOnLaunch,
      download,
      retryDownload,
      install,
      onStateChange: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }
    },
    download,
    retryDownload,
    install,
    checkOnLaunch
  };
}

beforeEach(() => {
  vi.useRealTimers();
});

describe('runLaunchUpdateCheck', () => {
  it('resolves no-update when checkOnLaunch returns unavailable', async () => {
    const env = createService();
    const splash = createSplashStub();

    const controller = runLaunchUpdateCheck({
      updateService: env.service,
      createSplash: () => splash
    });

    env.emit({ status: 'unavailable', unavailableReason: 'unpackaged' });

    await expect(controller.promise).resolves.toBe('no-update');
    expect(splash.close).not.toHaveBeenCalled();
  });

  it('resolves no-update when not_available is emitted', async () => {
    const env = createService();
    const splash = createSplashStub();

    const controller = runLaunchUpdateCheck({
      updateService: env.service,
      createSplash: () => splash
    });

    env.emit({ status: 'not_available', updateInfo: { version: '1.0.8' } });

    await expect(controller.promise).resolves.toBe('no-update');
  });

  it('times out the check phase and resolves no-update', async () => {
    vi.useFakeTimers();
    const env = createService();
    const splash = createSplashStub();

    const controller = runLaunchUpdateCheck({
      updateService: env.service,
      createSplash: () => splash,
      checkTimeoutMs: 100
    });

    vi.advanceTimersByTime(150);
    vi.useRealTimers();

    await expect(controller.promise).resolves.toBe('no-update');
  });

  it('mounts the splash and starts download when update is available', async () => {
    const env = createService();
    const splash = createSplashStub();
    const createSplash = vi.fn(() => splash);

    const controller = runLaunchUpdateCheck({
      updateService: env.service,
      createSplash
    });

    env.emit({ status: 'available', updateInfo: { version: '1.0.9' } });
    await new Promise((resolve) => setImmediate(resolve));

    expect(createSplash).toHaveBeenCalledTimes(1);
    expect(env.download).toHaveBeenCalledTimes(1);

    env.emit({ status: 'downloaded', updateInfo: { version: '1.0.9' } });
    await expect(controller.promise).resolves.toBe('installing');
    expect(env.install).toHaveBeenCalledTimes(1);
    expect(splash.close).not.toHaveBeenCalled();
  });

  it('retries once on download error and shows the continue link', async () => {
    const env = createService();
    env.download.mockResolvedValueOnce(fail('network'));
    env.retryDownload.mockResolvedValueOnce(ok({ status: 'downloading' as const }));
    const splash = createSplashStub();

    const controller = runLaunchUpdateCheck({
      updateService: env.service,
      createSplash: () => splash
    });

    env.emit({ status: 'available', updateInfo: { version: '1.0.9' } });
    await new Promise((resolve) => setImmediate(resolve));

    expect(env.retryDownload).toHaveBeenCalledTimes(1);
    expect(splash.sendShowContinueLink).toHaveBeenCalled();

    env.emit({ status: 'downloaded', updateInfo: { version: '1.0.9' } });
    await expect(controller.promise).resolves.toBe('installing');
  });

  it('auto-closes after retry failure', async () => {
    vi.useFakeTimers();
    const env = createService();
    env.download.mockResolvedValueOnce(fail('first failure'));
    env.retryDownload.mockResolvedValueOnce(fail('second failure'));
    const splash = createSplashStub();

    const controller = runLaunchUpdateCheck({
      updateService: env.service,
      createSplash: () => splash,
      errorAutoCloseDelayMs: 50
    });

    env.emit({ status: 'available', updateInfo: { version: '1.0.9' } });
    await vi.runOnlyPendingTimersAsync();
    await vi.runOnlyPendingTimersAsync();

    expect(splash.sendAutoCloseSoon).toHaveBeenCalledWith(50);
    vi.advanceTimersByTime(60);
    vi.useRealTimers();

    await expect(controller.promise).resolves.toBe('failed');
    expect(splash.close).toHaveBeenCalled();
  });

  it('continueWithoutUpdate resolves the controller and closes the splash', async () => {
    const env = createService();
    const splash = createSplashStub();

    const controller = runLaunchUpdateCheck({
      updateService: env.service,
      createSplash: () => splash
    });

    env.emit({ status: 'available', updateInfo: { version: '1.0.9' } });
    await new Promise((resolve) => setImmediate(resolve));

    controller.continueWithoutUpdate();

    await expect(controller.promise).resolves.toBe('continued-without-update');
    expect(splash.close).toHaveBeenCalled();
  });

  it('arms the stall timer on progress updates and shows continue link when stalled', async () => {
    vi.useFakeTimers();
    const env = createService();
    const splash = createSplashStub();

    runLaunchUpdateCheck({
      updateService: env.service,
      createSplash: () => splash,
      progressStallMs: 100
    });

    env.emit({ status: 'available', updateInfo: { version: '1.0.9' } });
    await vi.runOnlyPendingTimersAsync();

    env.emit({
      status: 'downloading',
      progress: { percent: 10, transferred: 100, total: 1000 }
    });
    vi.advanceTimersByTime(150);
    vi.useRealTimers();

    expect(splash.sendShowContinueLink).toHaveBeenCalled();
  });
});
