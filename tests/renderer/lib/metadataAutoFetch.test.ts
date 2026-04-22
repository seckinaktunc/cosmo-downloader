import { describe, expect, it } from 'vitest'
import type { AppSettings } from '@shared/types'
import { getMetadataAutoFetchKey } from '@renderer/lib/metadataAutoFetch'

const settings: AppSettings = {
  hardwareAcceleration: true,
  automaticUpdates: true,
  alwaysAskDownloadLocation: false,
  createFolderPerDownload: false,
  defaultDownloadLocation: '/downloads',
  lastDownloadDirectory: '/downloads',
  interfaceLanguage: 'en_US',
  cookiesBrowser: 'none',
  alwaysOnTop: false
}

describe('getMetadataAutoFetchKey', () => {
  it('returns null without settings or a non-empty URL', () => {
    expect(getMetadataAutoFetchKey('https://example.com/video', null)).toBeNull()
    expect(getMetadataAutoFetchKey('', settings)).toBeNull()
    expect(getMetadataAutoFetchKey('   ', settings)).toBeNull()
  })

  it('changes when the trimmed URL changes', () => {
    expect(getMetadataAutoFetchKey(' https://example.com/one ', settings)).toBe(
      getMetadataAutoFetchKey('https://example.com/one', settings)
    )
    expect(getMetadataAutoFetchKey('https://example.com/one', settings)).not.toBe(
      getMetadataAutoFetchKey('https://example.com/two', settings)
    )
  })

  it('changes when the cookie browser changes', () => {
    expect(getMetadataAutoFetchKey('https://example.com/video', settings)).not.toBe(
      getMetadataAutoFetchKey('https://example.com/video', {
        ...settings,
        cookiesBrowser: 'firefox'
      })
    )
  })

  it('ignores settings that metadata fetching does not use', () => {
    const baseKey = getMetadataAutoFetchKey('https://example.com/video', settings)

    expect(
      getMetadataAutoFetchKey('https://example.com/video', {
        ...settings,
        hardwareAcceleration: false,
        automaticUpdates: false,
        alwaysAskDownloadLocation: true,
        createFolderPerDownload: true,
        defaultDownloadLocation: '/other-downloads',
        lastDownloadDirectory: '/custom-output',
        interfaceLanguage: 'tr_TR',
        alwaysOnTop: true
      })
    ).toBe(baseKey)
  })
})
