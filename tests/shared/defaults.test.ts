import { describe, expect, it } from 'vitest'
import { DEFAULT_EXPORT_SETTINGS, mergeExportSettings } from '@shared/defaults'

describe('mergeExportSettings', () => {
  it('adds video bitrate and trim settings to older persisted settings', () => {
    expect(
      mergeExportSettings({
        outputFormat: 'mkv',
        resolution: 1080,
        audioBitrate: 'auto',
        frameRate: 'auto',
        videoCodec: 'auto',
        audioCodec: 'auto'
      })
    ).toEqual({
      ...DEFAULT_EXPORT_SETTINGS,
      outputFormat: 'mkv',
      resolution: 1080
    })
  })

  it('normalizes persisted trim values', () => {
    expect(
      mergeExportSettings({
        trimStartSeconds: 12.4,
        trimEndSeconds: 54.6
      })
    ).toEqual({
      ...DEFAULT_EXPORT_SETTINGS,
      trimStartSeconds: 12,
      trimEndSeconds: 55
    })
  })
})
