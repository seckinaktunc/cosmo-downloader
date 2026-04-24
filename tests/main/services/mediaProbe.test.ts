import { describe, expect, it } from 'vitest'
import { DEFAULT_EXPORT_SETTINGS } from '@shared/defaults'
import type { ExportSettings } from '@shared/types'
import {
  assertSelectedCodecs,
  audioCodecMatches,
  hasExplicitCodecSelection,
  verifySelectedCodecs,
  videoCodecMatches,
  type MediaProbeResult,
  type MediaProbeStream
} from '@main/services/mediaProbe'

function settings(update: Partial<ExportSettings>): ExportSettings {
  return {
    ...DEFAULT_EXPORT_SETTINGS,
    ...update
  }
}

function stream(codec_type: 'audio' | 'video', codec_name: string): MediaProbeStream {
  return { codec_type, codec_name }
}

const h264AacProbe: MediaProbeResult = {
  streams: [stream('video', 'h264'), stream('audio', 'aac')]
}

describe('codec verification', () => {
  it('matches h264, avc1, and avc as H.264', () => {
    expect(videoCodecMatches(stream('video', 'h264'), 'h264')).toBe(true)
    expect(videoCodecMatches({ codec_type: 'video', codec_tag_string: 'avc1' }, 'h264')).toBe(true)
    expect(videoCodecMatches({ codec_type: 'video', codec_long_name: 'AVC / H.264' }, 'h264')).toBe(
      true
    )
  })

  it('matches hevc and h265 as H.265', () => {
    expect(videoCodecMatches(stream('video', 'hevc'), 'h265')).toBe(true)
    expect(videoCodecMatches(stream('video', 'h265'), 'h265')).toBe(true)
  })

  it('matches ProRes family identifiers as ProRes', () => {
    expect(videoCodecMatches(stream('video', 'prores'), 'prores')).toBe(true)
    expect(videoCodecMatches({ codec_type: 'video', codec_tag_string: 'apch' }, 'prores')).toBe(
      true
    )
    expect(
      videoCodecMatches({ codec_type: 'video', codec_long_name: 'Apple ProRes 422 HQ' }, 'prores')
    ).toBe(true)
  })

  it('matches mp4a and aac as AAC/M4A', () => {
    expect(audioCodecMatches(stream('audio', 'aac'), 'aac')).toBe(true)
    expect(audioCodecMatches({ codec_type: 'audio', codec_tag_string: 'mp4a' }, 'm4a')).toBe(true)
  })

  it('fails mismatched VP9/Opus when H.264/AAC is selected', () => {
    const result = verifySelectedCodecs(settings({ videoCodec: 'h264', audioCodec: 'aac' }), {
      streams: [stream('video', 'vp9'), stream('audio', 'opus')]
    })

    expect(result.ok).toBe(false)
  })

  it('fails when a selected stream is missing', () => {
    const result = verifySelectedCodecs(settings({ videoCodec: 'h264', audioCodec: 'aac' }), {
      streams: [stream('video', 'h264')]
    })

    expect(result.ok).toBe(false)
  })

  it('identifies explicit codec selections', () => {
    expect(hasExplicitCodecSelection(settings({ videoCodec: 'h264' }))).toBe(true)
    expect(hasExplicitCodecSelection(settings({ audioCodec: 'aac' }))).toBe(true)
    expect(hasExplicitCodecSelection(settings({}))).toBe(false)
  })

  it('throws a clear final verification error', () => {
    expect(() =>
      assertSelectedCodecs(
        settings({ videoCodec: 'h264', audioCodec: 'aac' }),
        { streams: [stream('video', 'vp9'), stream('audio', 'opus')] },
        'processed output'
      )
    ).toThrow(/processed output/)
  })

  it('accepts selected H.264/AAC when the probe matches', () => {
    expect(
      verifySelectedCodecs(settings({ videoCodec: 'h264', audioCodec: 'aac' }), h264AacProbe)
    ).toEqual({ ok: true })
  })

  it('accepts selected ProRes when the probe matches a ProRes stream', () => {
    expect(
      verifySelectedCodecs(settings({ videoCodec: 'prores', audioCodec: 'aac' }), {
        streams: [
          { codec_type: 'video', codec_tag_string: 'apch' },
          { codec_type: 'audio', codec_name: 'aac' }
        ]
      })
    ).toEqual({ ok: true })
  })
})
