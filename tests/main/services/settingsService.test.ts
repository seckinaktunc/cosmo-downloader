import { describe, expect, it } from 'vitest';
import { createDefaultSettings } from '@shared/defaults';
import { mergeSettings } from '@main/services/settingsService';

describe('mergeSettings', () => {
  it('keeps defaults when saved settings are invalid', () => {
    const defaults = createDefaultSettings('/downloads');
    expect(mergeSettings(defaults, null)).toEqual(defaults);
  });

  it('merges valid persisted values and fills missing fields', () => {
    const defaults = createDefaultSettings('/downloads');
    expect(
      mergeSettings(defaults, {
        hardwareAcceleration: false,
        createFolderPerDownload: true,
        alwaysOnTop: true,
        defaultDownloadLocation: '/custom'
      })
    ).toEqual({
      ...defaults,
      hardwareAcceleration: false,
      createFolderPerDownload: true,
      alwaysOnTop: true,
      defaultDownloadLocation: '/custom'
    });
  });

  it('defaults create folder per download to off for legacy settings', () => {
    const defaults = createDefaultSettings('/downloads');

    expect(mergeSettings(defaults, {}).createFolderPerDownload).toBe(false);
  });

  it('ignores legacy always-ask and removed section keys', () => {
    const defaults = createDefaultSettings('/downloads');

    expect(
      mergeSettings(defaults, {
        alwaysAskDownloadLocation: true,
        preferencesSectionsExpanded: {
          general: false,
          downloads: false,
          metadata: false,
          updates: false
        }
      })
    ).toEqual({
      ...defaults,
      preferencesSectionsExpanded: {
        general: false,
        metadata: false
      }
    });
  });

  it('defaults cacheLimitMb to 50 for legacy settings', () => {
    const defaults = createDefaultSettings('/downloads');

    expect(mergeSettings(defaults, {}).cacheLimitMb).toBe(50);
  });

  it('defaults historyLimitItems to 500 for legacy settings', () => {
    const defaults = createDefaultSettings('/downloads');

    expect(mergeSettings(defaults, {}).historyLimitItems).toBe(500);
  });

  it('rounds and clamps cacheLimitMb into the supported range', () => {
    const defaults = createDefaultSettings('/downloads');

    expect(mergeSettings(defaults, { cacheLimitMb: 24.6 }).cacheLimitMb).toBe(25);
    expect(mergeSettings(defaults, { cacheLimitMb: 0 }).cacheLimitMb).toBe(1);
    expect(mergeSettings(defaults, { cacheLimitMb: 900 }).cacheLimitMb).toBe(500);
  });

  it('rounds and clamps historyLimitItems into the supported range', () => {
    const defaults = createDefaultSettings('/downloads');

    expect(mergeSettings(defaults, { historyLimitItems: 249.6 }).historyLimitItems).toBe(250);
    expect(mergeSettings(defaults, { historyLimitItems: 0 }).historyLimitItems).toBe(1);
    expect(mergeSettings(defaults, { historyLimitItems: 9000 }).historyLimitItems).toBe(5000);
  });

  it('merges the last automatic update check timestamp', () => {
    const defaults = createDefaultSettings('/downloads');
    const timestamp = '2026-04-19T10:00:00.000Z';

    expect(mergeSettings(defaults, { lastAutomaticUpdateCheckAt: timestamp })).toEqual({
      ...defaults,
      lastAutomaticUpdateCheckAt: timestamp
    });
  });

  it('merges the last notified app version', () => {
    const defaults = createDefaultSettings('/downloads');

    expect(mergeSettings(defaults, { lastNotifiedAppVersion: '1.0.8' })).toEqual({
      ...defaults,
      lastNotifiedAppVersion: '1.0.8'
    });
  });

  it('keeps lastNotifiedAppVersion undefined for legacy settings', () => {
    const defaults = createDefaultSettings('/downloads');

    expect(mergeSettings(defaults, {}).lastNotifiedAppVersion).toBeUndefined();
  });
});
