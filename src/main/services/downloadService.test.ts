import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, normalize } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_EXPORT_SETTINGS } from '../../shared/defaults'
import type { AppSettings, DownloadStartRequest, VideoMetadata } from '../../shared/types'
import {
  buildFfmpegTranscodeArgs,
  createFinalDestinationPath,
  shouldTranscodeAfterSourceProbe
} from './downloadService'

vi.mock('electron', () => ({
  app: {
    getPath: () => ''
  },
  dialog: {
    showSaveDialog: vi.fn()
  },
  Notification: {
    isSupported: () => false
  },
  webContents: {
    getAllWebContents: () => []
  }
}))

const settings: AppSettings = {
  hardwareAcceleration: false,
  automaticUpdates: true,
  alwaysAskDownloadLocation: false,
  createFolderPerDownload: false,
  defaultDownloadLocation: '/downloads',
  interfaceLanguage: 'en_US',
  cookiesBrowser: 'none',
  alwaysOnTop: false
}

const metadata: VideoMetadata = {
  requestId: 'request',
  url: 'https://example.com/video',
  title: 'Video',
  containers: [],
  videoCodecs: [],
  audioCodecs: [],
  fpsOptions: [],
  formats: []
}

const tempDirs: string[] = []

afterEach(() => {
  while (tempDirs.length > 0) {
    const directory = tempDirs.pop()
    if (directory) {
      rmSync(directory, { recursive: true, force: true })
    }
  }
})

function createTempDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'cosmo-download-'))
  tempDirs.push(directory)
  return directory
}

function request(update: Partial<DownloadStartRequest['exportSettings']>): DownloadStartRequest {
  return {
    metadata,
    settings,
    exportSettings: {
      ...DEFAULT_EXPORT_SETTINGS,
      ...update
    }
  }
}

describe('buildFfmpegTranscodeArgs', () => {
  it('adds video bitrate for video outputs', () => {
    const args = buildFfmpegTranscodeArgs(request({ videoBitrate: 8 }), 'input.mkv', 'output.mp4')

    expect(args).toContain('-b:v')
    expect(args).toContain('8M')
  })

  it('omits video bitrate for audio-only outputs', () => {
    const args = buildFfmpegTranscodeArgs(
      request({ outputFormat: 'mp3', videoBitrate: 8 }),
      'input.mkv',
      'output.mp3'
    )

    expect(args).not.toContain('-b:v')
    expect(args).not.toContain('8M')
  })
})

describe('createFinalDestinationPath', () => {
  it('wraps an explicit Windows-style output filename in a same-named folder', () => {
    expect(createFinalDestinationPath('C:\\Downloads', 'myVideo1', 'mp4', true)).toBe(
      'C:\\Downloads\\myVideo1\\myVideo1.mp4'
    )
  })

  it('wraps a POSIX-style output filename in a same-named folder on POSIX-equivalent paths', () => {
    expect(createFinalDestinationPath('/Users/me/Downloads', 'myVideo1', 'mkv', true)).toBe(
      normalize('/Users/me/Downloads/myVideo1/myVideo1.mkv')
    )
  })

  it('uses the sanitized metadata title as folder and file name for default-location downloads', () => {
    const directory = createTempDirectory()

    expect(createFinalDestinationPath(directory, 'My: Video?', 'mp4', true)).toBe(
      join(directory, 'My Video', 'My Video.mp4')
    )
  })

  it('reuses an existing folder and uniques only the filename inside it', () => {
    const directory = createTempDirectory()
    const folder = join(directory, 'myVideo1')
    mkdirSync(folder)
    writeFileSync(join(folder, 'myVideo1.mp4'), 'existing')

    expect(createFinalDestinationPath(directory, 'myVideo1', 'mp4', true)).toBe(
      join(folder, 'myVideo1 (1).mp4')
    )
  })

  it('preserves current output behavior when folder-per-download is disabled', () => {
    const directory = createTempDirectory()

    expect(createFinalDestinationPath(directory, 'myVideo1', 'mp4', false)).toBe(
      join(directory, 'myVideo1.mp4')
    )
  })
})

describe('shouldTranscodeAfterSourceProbe', () => {
  it('keeps direct output when selected codecs already match the downloaded file', () => {
    expect(
      shouldTranscodeAfterSourceProbe(false, request({ videoCodec: 'h264', audioCodec: 'aac' }), {
        streams: [
          { codec_type: 'video', codec_name: 'h264' },
          { codec_type: 'audio', codec_name: 'aac' }
        ]
      })
    ).toBe(false)
  })

  it('switches to transcode when selected codecs do not match the downloaded file', () => {
    expect(
      shouldTranscodeAfterSourceProbe(false, request({ videoCodec: 'h264', audioCodec: 'aac' }), {
        streams: [
          { codec_type: 'video', codec_name: 'vp9' },
          { codec_type: 'audio', codec_name: 'opus' }
        ]
      })
    ).toBe(true)
  })

  it('does not require ffprobe-driven transcode when codecs are automatic', () => {
    expect(
      shouldTranscodeAfterSourceProbe(false, request({}), {
        streams: [
          { codec_type: 'video', codec_name: 'vp9' },
          { codec_type: 'audio', codec_name: 'opus' }
        ]
      })
    ).toBe(false)
  })

  it('preserves an existing transcode requirement', () => {
    expect(
      shouldTranscodeAfterSourceProbe(true, request({ videoCodec: 'h264' }), {
        streams: [{ codec_type: 'video', codec_name: 'h264' }]
      })
    ).toBe(true)
  })
})
