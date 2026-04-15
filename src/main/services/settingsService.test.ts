import { describe, expect, it } from 'vitest'
import { createDefaultSettings } from '../../shared/defaults'
import { mergeSettings } from './settingsService'

describe('mergeSettings', () => {
  it('keeps defaults when saved settings are invalid', () => {
    const defaults = createDefaultSettings('/downloads')
    expect(mergeSettings(defaults, null)).toEqual(defaults)
  })

  it('merges valid persisted values and fills missing fields', () => {
    const defaults = createDefaultSettings('/downloads')
    expect(
      mergeSettings(defaults, {
        hardwareAcceleration: false,
        alwaysOnTop: true,
        defaultDownloadLocation: '/custom'
      })
    ).toEqual({
      ...defaults,
      hardwareAcceleration: false,
      alwaysOnTop: true,
      defaultDownloadLocation: '/custom'
    })
  })
})
