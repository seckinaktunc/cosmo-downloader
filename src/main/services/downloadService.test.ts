import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_EXPORT_SETTINGS } from '../../shared/defaults'
import type { AppSettings, DownloadStartRequest, VideoMetadata } from '../../shared/types'
import { buildFfmpegTranscodeArgs, shouldTranscodeAfterSourceProbe } from './downloadService'

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
