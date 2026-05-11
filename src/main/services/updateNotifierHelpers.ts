const UPDATED_BODY: Record<string, (version: string) => string> = {
  en_US: (version) => `Cosmo Downloader is updated to v${version}`,
  tr_TR: (version) => `Cosmo Downloader v${version} sürümüne güncellendi`,
  zh_CN: (version) => `Cosmo Downloader 已更新到 v${version}`
};

function parseSemver(version: string): number[] | null {
  const trimmed = version.replace(/^v/, '');
  const parts = trimmed.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.length === 0 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  return parts;
}

export function isVersionGreater(candidate: string, baseline: string): boolean {
  const a = parseSemver(candidate);
  const b = parseSemver(baseline);
  if (a == null || b == null) {
    return false;
  }

  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left > right) {
      return true;
    }
    if (left < right) {
      return false;
    }
  }
  return false;
}

export function shouldNotifyOfUpdate(currentVersion: string, lastNotified?: string): boolean {
  if (!lastNotified) {
    return false;
  }

  return isVersionGreater(currentVersion, lastNotified);
}

export function getUpdatedNotificationBody(currentVersion: string, locale: string): string {
  const builder = UPDATED_BODY[locale] ?? UPDATED_BODY.en_US;
  return builder(currentVersion);
}
