import { EventEmitter } from 'events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachSmokeTestHandlers } from '../../src/main/smokeTest';

function createSmokeTestWindow() {
  const webContents = new EventEmitter() as EventEmitter & {
    on: EventEmitter['on'];
    once: EventEmitter['once'];
  };
  const mainWindow = new EventEmitter() as EventEmitter & {
    on: EventEmitter['on'];
    webContents: typeof webContents;
  };

  mainWindow.webContents = webContents;
  return { mainWindow, webContents };
}

describe('attachSmokeTestHandlers', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('exits successfully after did-finish-load', () => {
    vi.useFakeTimers();
    const exit = vi.fn();
    const { mainWindow, webContents } = createSmokeTestWindow();

    attachSmokeTestHandlers({ exit }, mainWindow, 250);
    webContents.emit('did-finish-load');
    vi.advanceTimersByTime(249);

    expect(exit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('fails the smoke test when the renderer load fails', () => {
    const exit = vi.fn();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { mainWindow, webContents } = createSmokeTestWindow();

    attachSmokeTestHandlers({ exit }, mainWindow, 250);
    webContents.emit('did-fail-load', {}, -3, 'ERR_ABORTED');

    expect(exit).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith('[smoke-test] renderer failed to load (-3): ERR_ABORTED');

    errorSpy.mockRestore();
  });
});
