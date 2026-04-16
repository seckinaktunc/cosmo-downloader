import { isAudioOnlyFormat } from '../../shared/formatOptions'
import type { AudioCodec, ExportSettings, VideoCodec } from '../../shared/types'
import { captureProcess } from '../utils/process'

export type MediaProbeStream = {
  codec_type?: string
  codec_name?: string
  codec_tag_string?: string
  codec_long_name?: string
  profile?: string
}

export type MediaProbeResult = {
  streams: MediaProbeStream[]
}

export type CodecVerificationResult = { ok: true } | { ok: false; reason: string }

function normalizeCodecText(value?: string): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function streamCodecText(stream: MediaProbeStream): string {
  return [stream.codec_name, stream.codec_tag_string, stream.codec_long_name, stream.profile]
    .map(normalizeCodecText)
    .filter(Boolean)
    .join(' ')
}

export function hasExplicitCodecSelection(settings: ExportSettings): boolean {
  const needsVideoVerification =
    !isAudioOnlyFormat(settings.outputFormat) && settings.videoCodec !== 'auto'
  return needsVideoVerification || settings.audioCodec !== 'auto'
}

export function videoCodecMatches(stream: MediaProbeStream, requested: VideoCodec): boolean {
  if (requested === 'auto') {
    return true
  }

  const codecText = streamCodecText(stream)
  if (requested === 'h264') return codecText.includes('h264') || codecText.includes('avc')
  if (requested === 'h265') return codecText.includes('h265') || codecText.includes('hevc')
  if (requested === 'av1') return codecText.includes('av1') || codecText.includes('av01')
  if (requested === 'vp9') return codecText.includes('vp9') || codecText.includes('vp09')
  return false
}

export function audioCodecMatches(stream: MediaProbeStream, requested: AudioCodec): boolean {
  if (requested === 'auto') {
    return true
  }

  const codecText = streamCodecText(stream)
  if (requested === 'aac' || requested === 'm4a') {
    return codecText.includes('aac') || codecText.includes('mp4a')
  }
  if (requested === 'opus') return codecText.includes('opus')
  if (requested === 'vorbis') return codecText.includes('vorbis')
  if (requested === 'mp3') return codecText.includes('mp3')
  return false
}

export function verifySelectedCodecs(
  settings: ExportSettings,
  probe: MediaProbeResult
): CodecVerificationResult {
  const videoStream = probe.streams.find((stream) => stream.codec_type === 'video')
  const audioStream = probe.streams.find((stream) => stream.codec_type === 'audio')

  if (!isAudioOnlyFormat(settings.outputFormat) && settings.videoCodec !== 'auto') {
    if (!videoStream) {
      return {
        ok: false,
        reason: `Expected ${settings.videoCodec} video, but no video stream exists.`
      }
    }

    if (!videoCodecMatches(videoStream, settings.videoCodec)) {
      return {
        ok: false,
        reason: `Expected ${settings.videoCodec} video, found ${videoStream.codec_name ?? 'unknown'}.`
      }
    }
  }

  if (settings.audioCodec !== 'auto') {
    if (!audioStream) {
      return {
        ok: false,
        reason: `Expected ${settings.audioCodec} audio, but no audio stream exists.`
      }
    }

    if (!audioCodecMatches(audioStream, settings.audioCodec)) {
      return {
        ok: false,
        reason: `Expected ${settings.audioCodec} audio, found ${audioStream.codec_name ?? 'unknown'}.`
      }
    }
  }

  return { ok: true }
}

export function assertSelectedCodecs(
  settings: ExportSettings,
  probe: MediaProbeResult,
  fileLabel: string
): void {
  const verification = verifySelectedCodecs(settings, probe)
  if (!verification.ok) {
    throw new Error(`Codec verification failed for ${fileLabel}: ${verification.reason}`)
  }
}

function parseProbeOutput(stdout: string): MediaProbeResult {
  const parsed = JSON.parse(stdout) as unknown
  if (
    typeof parsed !== 'object' ||
    parsed == null ||
    !Array.isArray((parsed as { streams?: unknown }).streams)
  ) {
    throw new Error('ffprobe returned an unexpected response.')
  }

  return { streams: (parsed as { streams: MediaProbeStream[] }).streams }
}

export async function probeMediaFile(
  ffprobePath: string,
  filePath: string
): Promise<MediaProbeResult> {
  const result = await captureProcess(ffprobePath, [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_streams',
    filePath
  ])

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || `ffprobe exited with code ${result.exitCode}.`)
  }

  try {
    return parseProbeOutput(result.stdout)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to parse ffprobe output: ${message}`)
  }
}
