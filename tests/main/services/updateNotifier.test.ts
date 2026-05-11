import { describe, expect, it } from 'vitest';
import {
  getUpdatedNotificationBody,
  isVersionGreater,
  shouldNotifyOfUpdate
} from '@main/services/updateNotifierHelpers';

describe('isVersionGreater', () => {
  it('returns true when the candidate is a higher semver', () => {
    expect(isVersionGreater('1.0.9', '1.0.8')).toBe(true);
    expect(isVersionGreater('1.1.0', '1.0.99')).toBe(true);
    expect(isVersionGreater('2.0.0', '1.99.99')).toBe(true);
  });

  it('returns false on equal versions', () => {
    expect(isVersionGreater('1.0.8', '1.0.8')).toBe(false);
  });

  it('returns false on downgrades', () => {
    expect(isVersionGreater('1.0.7', '1.0.8')).toBe(false);
    expect(isVersionGreater('0.9.0', '1.0.0')).toBe(false);
  });

  it('handles a leading v prefix gracefully', () => {
    expect(isVersionGreater('v1.0.9', '1.0.8')).toBe(true);
  });

  it('returns false on unparseable input', () => {
    expect(isVersionGreater('not-a-version', '1.0.0')).toBe(false);
  });
});

describe('shouldNotifyOfUpdate', () => {
  it('returns false on first launch when no previous version exists', () => {
    expect(shouldNotifyOfUpdate('1.0.9', undefined)).toBe(false);
  });

  it('returns false when the version is unchanged', () => {
    expect(shouldNotifyOfUpdate('1.0.9', '1.0.9')).toBe(false);
  });

  it('returns false when running an older build (downgrade)', () => {
    expect(shouldNotifyOfUpdate('1.0.7', '1.0.9')).toBe(false);
  });

  it('returns true when the current version is newer than the last notified version', () => {
    expect(shouldNotifyOfUpdate('1.0.9', '1.0.8')).toBe(true);
  });
});

describe('getUpdatedNotificationBody', () => {
  it('returns the English body by default', () => {
    expect(getUpdatedNotificationBody('1.0.9', 'en_US')).toBe(
      'Cosmo Downloader is updated to v1.0.9'
    );
  });

  it('returns the Turkish body when locale matches', () => {
    expect(getUpdatedNotificationBody('1.0.9', 'tr_TR')).toContain('1.0.9');
  });

  it('returns the Simplified Chinese body when locale matches', () => {
    expect(getUpdatedNotificationBody('1.0.9', 'zh_CN')).toContain('1.0.9');
  });

  it('falls back to English for unknown locales', () => {
    expect(getUpdatedNotificationBody('1.0.9', 'xx_XX')).toBe(
      'Cosmo Downloader is updated to v1.0.9'
    );
  });
});
