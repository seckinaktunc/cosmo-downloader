import type { AppSettings } from '../../../shared/types'

export function getMetadataAutoFetchKey(
  url: string,
  settings: Pick<AppSettings, 'cookiesBrowser'> | null | undefined
): string | null {
  const trimmedUrl = url.trim()
  if (!settings || trimmedUrl.length === 0) {
    return null
  }

  return `${trimmedUrl}\u001f${settings.cookiesBrowser}`
}
