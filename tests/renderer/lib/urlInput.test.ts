import { describe, expect, it } from 'vitest'
import { getValidClipboardUrl, getValidLookingSingleVideoUrl } from '@renderer/lib/urlInput'

describe('urlInput helpers', () => {
  it('extracts a valid URL from clipboard text', () => {
    expect(getValidClipboardUrl('watch https://example.com/video now')).toBe(
      'https://example.com/video'
    )
  })

  it('rejects non-URL clipboard text', () => {
    expect(getValidClipboardUrl('not a url')).toBeNull()
  })

  it('detects valid-looking single video URLs for optimistic metadata state', () => {
    expect(getValidLookingSingleVideoUrl('youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'https://youtube.com/watch?v=dQw4w9WgXcQ'
    )
    expect(getValidLookingSingleVideoUrl('https://example.com/video')).toBe(
      'https://example.com/video'
    )
  })

  it('does not treat random text, playlists, channels, or local files as optimistic URLs', () => {
    expect(getValidLookingSingleVideoUrl('not a url')).toBeNull()
    expect(getValidLookingSingleVideoUrl('https://youtube.com/playlist?list=abc')).toBeNull()
    expect(getValidLookingSingleVideoUrl('https://youtube.com/@cosmo')).toBeNull()
    expect(getValidLookingSingleVideoUrl('file:///C:/video.mp4')).toBeNull()
  })
})
