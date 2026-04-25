import { describe, expect, it } from 'vitest'
import { DEFAULT_EXPORT_SETTINGS } from '@shared/defaults'
import {
  coerceExportSettingsForFormat,
  getDisabledCodecOptions,
  isAudioCodecAllowedForFormat,
  isVideoCodecAllowedForFormat
} from '@shared/exportCompatibility'

describe('export compatibility helpers', () => {
  it('allows ProRes for MOV and rejects incompatible WebM codecs', () => {
    expect(isVideoCodecAllowedForFormat('mov', 'prores')).toBe(true)
    expect(isVideoCodecAllowedForFormat('webm', 'h264')).toBe(false)
    expect(isVideoCodecAllowedForFormat('webm', 'h265')).toBe(false)
    expect(isVideoCodecAllowedForFormat('webm', 'prores')).toBe(false)
  })

  it('locks audio codecs to auto for MP3 and WAV', () => {
    expect(isAudioCodecAllowedForFormat('mp3', 'auto')).toBe(true)
    expect(isAudioCodecAllowedForFormat('wav', 'auto')).toBe(true)
    expect(isAudioCodecAllowedForFormat('mp3', 'aac')).toBe(false)
    expect(isAudioCodecAllowedForFormat('wav', 'opus')).toBe(false)

    expect(getDisabledCodecOptions({ outputFormat: 'mp3' }).audio).toEqual([
      'opus',
      'vorbis',
      'aac',
      'm4a',
      'mp3'
    ])
    expect(getDisabledCodecOptions({ outputFormat: 'wav' }).audio).toEqual([
      'opus',
      'vorbis',
      'aac',
      'm4a',
      'mp3'
    ])
  })

  it('disables incompatible WebM video and audio codecs', () => {
    expect(getDisabledCodecOptions({ outputFormat: 'webm' })).toEqual({
      video: ['prores', 'h265', 'h264'],
      audio: ['aac', 'm4a', 'mp3']
    })
  })

  it('coerces incompatible codecs to auto when the format changes', () => {
    expect(
      coerceExportSettingsForFormat(
        {
          ...DEFAULT_EXPORT_SETTINGS,
          outputFormat: 'mkv',
          videoCodec: 'prores',
          audioCodec: 'vorbis'
        },
        'mp4'
      )
    ).toMatchObject({
      outputFormat: 'mp4',
      videoCodec: 'auto',
      audioCodec: 'auto'
    })
  })

  it('preserves compatible codecs when the format changes', () => {
    expect(
      coerceExportSettingsForFormat(
        {
          ...DEFAULT_EXPORT_SETTINGS,
          outputFormat: 'mkv',
          videoCodec: 'h264',
          audioCodec: 'aac'
        },
        'mp4'
      )
    ).toMatchObject({
      outputFormat: 'mp4',
      videoCodec: 'h264',
      audioCodec: 'aac'
    })
  })
})
