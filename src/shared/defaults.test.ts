import { describe, expect, it } from 'vitest'
import { DEFAULT_EXPORT_SETTINGS, mergeExportSettings } from './defaults'

describe('mergeExportSettings', () => {
  it('adds video bitrate to older persisted settings', () => {
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
})
