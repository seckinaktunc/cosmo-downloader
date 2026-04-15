import { describe, expect, it } from 'vitest'
import {
  parseFfmpegProgressChunk,
  parseProgressNumber,
  parseYtdlpProgressLine
} from './progressParser'

describe('progress parser', () => {
  it('parses prefixed yt-dlp progress lines', () => {
    expect(parseYtdlpProgressLine('cosmo-download| 42.4%|1.2MiB/s|00:03|1048576|2097152')).toEqual({
      percentage: 42.4,
      speed: '1.2MiB/s',
      eta: '00:03',
      downloadedBytes: 1048576,
      totalBytes: 2097152
    })
  })

  it('parses bare pipe yt-dlp progress lines defensively', () => {
    expect(parseYtdlpProgressLine('  1.1%|  12.11MiB/s|00:00|31744|2848208')).toEqual({
      percentage: 1.1,
      speed: '12.11MiB/s',
      eta: '00:00',
      downloadedBytes: 31744,
      totalBytes: 2848208
    })
  })

  it('ignores invalid progress lines', () => {
    expect(parseYtdlpProgressLine('[download] Destination: file.mp4')).toBeNull()
  })

  it('clamps parsed percentages', () => {
    expect(parseProgressNumber('140%')).toBe(100)
    expect(parseProgressNumber('-1%')).toBe(0)
  })

  it('buffers split ffmpeg progress lines', () => {
    const first = parseFfmpegProgressChunk('', 'out_time_ms=250000', 10)
    expect(first.progress).toBeUndefined()
    const second = parseFfmpegProgressChunk(first.buffer, '0\nprogress=continue\n', 10)
    expect(second.progress?.percentage).toBe(25)
    expect(second.buffer).toBe('')
  })
})
