import { describe, expect, it } from 'vitest'
import type { ExportSettings, VideoMetadata } from '../../shared/types'
import { createDownloadPlan } from './formatPlanner'

const metadata: VideoMetadata = {
  requestId: 'request',
  url: 'https://example.com/video',
  title: 'Example',
  maxResolution: 2160,
  containers: ['mp4', 'webm'],
  videoCodecs: ['avc1', 'vp9'],
  audioCodecs: ['mp4a', 'opus'],
  fpsOptions: [30, 60],
  formats: [
    {
      id: 'mp4-1080',
      extension: 'mp4',
      height: 1080,
      videoCodec: 'avc1',
      audioCodec: 'mp4a'
    },
    {
      id: 'webm-2160',
      extension: 'webm',
      height: 2160,
      videoCodec: 'vp9',
      audioCodec: 'opus'
    }
  ]
}

const baseSettings: ExportSettings = {
  outputFormat: 'mp4',
  resolution: 1080,
  videoBitrate: 'auto',
  audioBitrate: 'auto',
  frameRate: 'auto',
  videoCodec: 'auto',
  audioCodec: 'auto'
}

describe('createDownloadPlan', () => {
  it('uses direct output when the matching container is available', () => {
    expect(createDownloadPlan(metadata, baseSettings).strategy).toBe('direct')
  })

  it('uses remux when only the container differs', () => {
    expect(createDownloadPlan(metadata, { ...baseSettings, outputFormat: 'mkv' }).strategy).toBe(
      'remux'
    )
  })

  it('uses transcode when codecs must change', () => {
    expect(createDownloadPlan(metadata, { ...baseSettings, videoCodec: 'h265' }).strategy).toBe(
      'transcode'
    )
  })

  it('uses transcode when automatic MP4 output would otherwise use incompatible codecs', () => {
    expect(createDownloadPlan(metadata, { ...baseSettings, resolution: 'auto' }).strategy).toBe(
      'transcode'
    )
  })

  it('uses transcode for audio-only output', () => {
    expect(createDownloadPlan(metadata, { ...baseSettings, outputFormat: 'mp3' }).strategy).toBe(
      'transcode'
    )
  })

  it('uses transcode when video bitrate is selected', () => {
    expect(createDownloadPlan(metadata, { ...baseSettings, videoBitrate: 8 }).strategy).toBe(
      'transcode'
    )
  })
})
