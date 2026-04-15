import type { AudioCodec, OutputFormat, VideoCodec } from './types'

export const RESOLUTION_OPTIONS = [360, 480, 720, 1080, 1440, 2160] as const
export const AUDIO_BITRATE_OPTIONS = ['auto', 128, 192, 256, 320] as const
export const FRAME_RATE_OPTIONS = ['auto', 24, 30, 60] as const

export const OUTPUT_FORMATS: OutputFormat[] = ['mp4', 'mkv', 'webm', 'mp3', 'wav']
export const VIDEO_CODECS: VideoCodec[] = ['auto', 'av1', 'vp9', 'h265', 'h264']
export const AUDIO_CODECS: AudioCodec[] = ['auto', 'opus', 'vorbis', 'aac', 'm4a', 'mp3']

export function isAudioOnlyFormat(format: OutputFormat): boolean {
  return format === 'mp3' || format === 'wav'
}
