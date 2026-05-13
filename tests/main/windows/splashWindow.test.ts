import { describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '@shared/types';

vi.mock('electron', () => ({
  BrowserWindow: class {}
}));

vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: false }
}));

vi.mock('@main/appIdentity', () => ({
  APP_ID: 'com.test',
  APP_NAME: 'Cosmo Downloader',
  APP_ICON: '/icon.png'
}));

const { isSplashEligible } = await import('@main/windows/splashWindow');

const baseSettings: AppSettings = {
  hardwareAcceleration: true,
  automaticUpdates: true,
  createFolderPerDownload: false,
  defaultDownloadLocation: '/downloads',
  interfaceLanguage: 'en_US',
  cookiesBrowser: 'none',
  alwaysOnTop: false,
  clipboardPrefetchEnabled: true,
  cacheLimitMb: 50,
  historyLimitItems: 500,
  preferencesSectionsExpanded: {
    general: true,
    metadata: true
  }
};

describe('isSplashEligible', () => {
  it('is eligible when packaged and automaticUpdates is on', () => {
    expect(isSplashEligible(baseSettings, true)).toBe(true);
  });

  it('is not eligible when unpackaged (development)', () => {
    expect(isSplashEligible(baseSettings, false)).toBe(false);
  });

  it('is not eligible when automaticUpdates is off', () => {
    expect(isSplashEligible({ ...baseSettings, automaticUpdates: false }, true)).toBe(false);
  });
});
