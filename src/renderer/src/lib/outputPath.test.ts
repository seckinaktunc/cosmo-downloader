import { describe, expect, it } from 'vitest'
import { replaceOutputExtension } from './outputPath'

describe('replaceOutputExtension', () => {
  it('updates a Windows path extension', () => {
    expect(replaceOutputExtension('C:\\Downloads\\video.webm', 'mp4')).toBe(
      'C:\\Downloads\\video.mp4'
    )
  })

  it('adds an extension when the path has none', () => {
    expect(replaceOutputExtension('/home/user/video', 'mkv')).toBe('/home/user/video.mkv')
  })
})
