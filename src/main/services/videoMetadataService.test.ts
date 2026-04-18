import { describe, expect, it } from 'vitest'
import { parseMetadata } from './videoMetadataService'

describe('parseMetadata', () => {
  it('prefers uploader URL metadata for owner profile links', () => {
    const metadata = parseMetadata('request', 'https://example.com/video', {
      title: 'Video',
      uploader: 'Owner',
      uploader_url: 'https://example.com/@owner',
      channel_url: 'https://example.com/channel/owner',
      formats: []
    })

    expect(metadata.uploaderUrl).toBe('https://example.com/@owner')
  })

  it('falls back to channel URL when uploader URL is unavailable', () => {
    const metadata = parseMetadata('request', 'https://example.com/video', {
      title: 'Video',
      channel: 'Channel',
      channel_url: 'https://example.com/channel/owner',
      formats: []
    })

    expect(metadata.uploaderUrl).toBe('https://example.com/channel/owner')
  })
})
