import { describe, expect, it } from 'vitest'
import {
  buildOutputPath,
  getEffectiveSavePath,
  getOutputDirectory,
  replaceOutputExtension,
  sanitizeOutputFilename
} from './outputPath'

describe('replaceOutputExtension', () => {
  it('updates a Windows path extension', () => {
    expect(replaceOutputExtension('C:\\Downloads\\video.webm', 'mp4')).toBe(
      'C:\\Downloads\\video.mp4'
    )
  })

  it('adds an extension when the path has none', () => {
    expect(replaceOutputExtension('/home/user/video', 'mkv')).toBe('/home/user/video.mkv')
  })

  it('keeps the new basename when changing only the extension', () => {
    expect(replaceOutputExtension('C:\\Downloads\\New Video.mp4', 'webm')).toBe(
      'C:\\Downloads\\New Video.webm'
    )
  })
})

describe('output path helpers', () => {
  it('extracts Windows and POSIX directories', () => {
    expect(getOutputDirectory('C:\\Downloads\\Old Video.mp4')).toBe('C:\\Downloads')
    expect(getOutputDirectory('/Users/me/Downloads/Old.webm')).toBe('/Users/me/Downloads')
  })

  it('builds an output path with the provided directory and title', () => {
    expect(buildOutputPath('C:\\Downloads', 'New Video', 'mp4')).toBe(
      'C:\\Downloads\\New Video.mp4'
    )
    expect(buildOutputPath('/Users/me/Downloads', 'New Video', 'mkv')).toBe(
      '/Users/me/Downloads/New Video.mkv'
    )
  })

  it('sanitizes illegal filename characters', () => {
    expect(sanitizeOutputFilename('New: Video? <Final>.')).toBe('New Video Final')
  })

  it('returns the original path with current extension when folder-per-download is disabled', () => {
    expect(getEffectiveSavePath('C:\\Downloads\\myVideo1.webm', 'mp4', false)).toBe(
      'C:\\Downloads\\myVideo1.mp4'
    )
  })

  it('displays the nested Windows folder-per-download path', () => {
    expect(getEffectiveSavePath('C:\\Downloads\\myVideo1.mp4', 'mp4', true)).toBe(
      'C:\\Downloads\\myVideo1\\myVideo1.mp4'
    )
  })

  it('displays the nested POSIX folder-per-download path', () => {
    expect(getEffectiveSavePath('/Users/me/Downloads/myVideo1.mp4', 'mp4', true)).toBe(
      '/Users/me/Downloads/myVideo1/myVideo1.mp4'
    )
  })

  it('sanitizes the displayed folder and file name', () => {
    expect(getEffectiveSavePath('C:\\Downloads\\my:Video?.mp4', 'mp4', true)).toBe(
      'C:\\Downloads\\my Video\\my Video.mp4'
    )
  })

  it('handles paths without a directory', () => {
    expect(getEffectiveSavePath('myVideo1.mp4', 'mp4', true)).toBe('myVideo1/myVideo1.mp4')
  })
})
