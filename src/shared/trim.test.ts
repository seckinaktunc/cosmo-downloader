import { describe, expect, it } from 'vitest'
import { DEFAULT_EXPORT_SETTINGS } from './defaults'
import { formatTimecode, isTrimActive, normalizeTrimRange, parseTimecode } from './trim'

describe('timecode helpers', () => {
  it('parses raw seconds and common timecode formats', () => {
    expect(parseTimecode('90')).toBe(90)
    expect(parseTimecode('1:30')).toBe(90)
    expect(parseTimecode('00:01:30')).toBe(90)
  })

  it('rejects invalid, negative, and malformed timecodes', () => {
    expect(parseTimecode('abc')).toBeNull()
    expect(parseTimecode('-1')).toBeNull()
    expect(parseTimecode('1:90')).toBeNull()
    expect(parseTimecode('1:2:3:4')).toBeNull()
  })

  it('formats short and long durations', () => {
    expect(formatTimecode(90)).toBe('1:30')
    expect(formatTimecode(3630)).toBe('1:00:30')
  })
})

describe('trim range helpers', () => {
  it('clamps trim ranges into the video duration', () => {
    expect(normalizeTrimRange(-10, 200, 120)).toEqual({
      startSeconds: 0,
      endSeconds: 120
    })
  })

  it('enforces a one-second minimum length', () => {
    expect(normalizeTrimRange(30, 30, 120)).toEqual({
      startSeconds: 30,
      endSeconds: 31
    })
  })

  it('detects active trim only when the range differs from full duration', () => {
    expect(
      isTrimActive({ ...DEFAULT_EXPORT_SETTINGS, trimStartSeconds: 0, trimEndSeconds: 120 }, 120)
    ).toBe(false)
    expect(
      isTrimActive({ ...DEFAULT_EXPORT_SETTINGS, trimStartSeconds: 10, trimEndSeconds: 120 }, 120)
    ).toBe(true)
    expect(
      isTrimActive({ ...DEFAULT_EXPORT_SETTINGS, trimStartSeconds: 0, trimEndSeconds: 90 }, 120)
    ).toBe(true)
  })
})
