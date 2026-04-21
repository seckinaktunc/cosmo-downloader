import { describe, expect, it } from 'vitest'
import {
  extractDroppedSingleVideoUrl,
  getValidClipboardUrl,
  getValidLookingSingleVideoUrl
} from '@renderer/lib/urlInput'

function dataTransfer({
  files = [],
  uriList = '',
  text = ''
}: {
  files?: unknown[]
  uriList?: string
  text?: string
}): DataTransfer {
  return {
    files,
    getData: (format: string) => {
      if (format === 'text/uri-list') {
        return uriList
      }

      if (format === 'text/plain') {
        return text
      }

      return ''
    }
  } as DataTransfer
}

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

  it('extracts single-video URLs from dropped URI lists or text', () => {
    expect(
      extractDroppedSingleVideoUrl(
        dataTransfer({ uriList: '# comment\nhttps://youtube.com/watch?v=dQw4w9WgXcQ' })
      )
    ).toBe('https://youtube.com/watch?v=dQw4w9WgXcQ')
    expect(
      extractDroppedSingleVideoUrl(dataTransfer({ text: 'youtube.com/watch?v=dQw4w9WgXcQ' }))
    ).toBe('https://youtube.com/watch?v=dQw4w9WgXcQ')
  })

  it('rejects dropped files, invalid text, playlists, and channels', () => {
    expect(
      extractDroppedSingleVideoUrl(
        dataTransfer({ files: [{}], text: 'youtube.com/watch?v=dQw4w9WgXcQ' })
      )
    ).toBeNull()
    expect(extractDroppedSingleVideoUrl(dataTransfer({ text: 'not a url' }))).toBeNull()
    expect(
      extractDroppedSingleVideoUrl(dataTransfer({ text: 'https://youtube.com/playlist?list=abc' }))
    ).toBeNull()
    expect(
      extractDroppedSingleVideoUrl(dataTransfer({ text: 'https://youtube.com/@cosmo' }))
    ).toBeNull()
  })
})
