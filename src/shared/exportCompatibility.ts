import { AUDIO_CODECS, VIDEO_CODECS } from './formatOptions'
import type { AudioCodec, ExportSettings, OutputFormat, VideoCodec } from './types'

const ALLOWED_VIDEO_CODECS: Record<OutputFormat, readonly VideoCodec[]> = {
  mp4: ['auto', 'av1', 'h265', 'h264'],
  mkv: [...VIDEO_CODECS],
  mov: ['auto', 'prores', 'h265', 'h264'],
  webm: ['auto', 'av1', 'vp9'],
  mp3: ['auto'],
  wav: ['auto']
}

const ALLOWED_AUDIO_CODECS: Record<OutputFormat, readonly AudioCodec[]> = {
  mp4: ['auto', 'aac', 'm4a', 'mp3'],
  mkv: [...AUDIO_CODECS],
  mov: ['auto', 'aac', 'm4a', 'mp3'],
  webm: ['auto', 'opus', 'vorbis'],
  mp3: ['auto'],
  wav: ['auto']
}

export function isVideoCodecAllowedForFormat(
  outputFormat: OutputFormat,
  videoCodec: VideoCodec
): boolean {
  return ALLOWED_VIDEO_CODECS[outputFormat].includes(videoCodec)
}

export function isAudioCodecAllowedForFormat(
  outputFormat: OutputFormat,
  audioCodec: AudioCodec
): boolean {
  return ALLOWED_AUDIO_CODECS[outputFormat].includes(audioCodec)
}

export function getDisabledCodecOptions(settings: Pick<ExportSettings, 'outputFormat'>): {
  video: VideoCodec[]
  audio: AudioCodec[]
} {
  return {
    video: VIDEO_CODECS.filter(
      (codec) => !isVideoCodecAllowedForFormat(settings.outputFormat, codec)
    ),
    audio: AUDIO_CODECS.filter(
      (codec) => !isAudioCodecAllowedForFormat(settings.outputFormat, codec)
    )
  }
}

export function coerceExportSettingsForFormat(
  exportSettings: ExportSettings,
  outputFormat: OutputFormat = exportSettings.outputFormat
): ExportSettings {
  return {
    ...exportSettings,
    outputFormat,
    videoCodec: isVideoCodecAllowedForFormat(outputFormat, exportSettings.videoCodec)
      ? exportSettings.videoCodec
      : 'auto',
    audioCodec: isAudioCodecAllowedForFormat(outputFormat, exportSettings.audioCodec)
      ? exportSettings.audioCodec
      : 'auto'
  }
}
