import { describe, expect, it } from 'vitest'
import { classifyVideoUrl, normalizeInputUrl, validateUrl } from '@shared/url'

describe('url helpers', () => {
  it('normalizes protocol-less input', () => {
    expect(normalizeInputUrl('youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'https://youtube.com/watch?v=dQw4w9WgXcQ'
    )
  })

  it('rejects local URLs', () => {
    expect(validateUrl('http://localhost:3000/video').isValid).toBe(false)
  })

  it('classifies YouTube single video URLs', () => {
    expect(classifyVideoUrl('https://youtu.be/dQw4w9WgXcQ')).toBe('single')
    expect(classifyVideoUrl('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('single')
  })

  it('classifies obvious playlist and channel URLs', () => {
    expect(classifyVideoUrl('https://youtube.com/playlist?list=PL123')).toBe('playlist')
    expect(classifyVideoUrl('https://youtube.com/@example')).toBe('channel')
  })
})
