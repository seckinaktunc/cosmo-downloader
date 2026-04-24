import type { ExportSettings, OutputFormat, VideoFormat, VideoMetadata } from '../../shared/types'
import { isAudioOnlyFormat } from '../../shared/formatOptions'

export type ProcessingStrategy = 'direct' | 'remux' | 'transcode'

export type DownloadPlan = {
  strategy: ProcessingStrategy
  formatSelector: string
  targetExtension: OutputFormat
  needsFfmpegTranscode: boolean
  ytdlpMergeFormat?: OutputFormat
  selectedHeight?: number
}

const PRORES_CODEC_MARKERS = ['prores', 'apch', 'apcn', 'apcs', 'apco', 'ap4h', 'ap4x'] as const

function normalizeCodec(codec?: string): string {
  return (codec ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function codecMatches(codec: string | undefined, requested: string): boolean {
  const normalized = normalizeCodec(codec)
  if (requested === 'h264') return normalized.includes('h264') || normalized.includes('avc')
  if (requested === 'h265') return normalized.includes('h265') || normalized.includes('hevc')
  if (requested === 'av1') return normalized.includes('av01') || normalized.includes('av1')
  if (requested === 'vp9') return normalized.includes('vp9') || normalized.includes('vp09')
  if (requested === 'prores')
    return PRORES_CODEC_MARKERS.some((marker) => normalized.includes(marker))
  if (requested === 'aac' || requested === 'm4a')
    return normalized.includes('aac') || normalized.includes('mp4a')
  if (requested === 'opus') return normalized.includes('opus')
  if (requested === 'vorbis') return normalized.includes('vorbis')
  if (requested === 'mp3') return normalized.includes('mp3')
  return false
}

function containerMatches(format: VideoFormat, outputFormat: OutputFormat): boolean {
  const extension = format.extension.toLowerCase()
  const container = (format.container ?? '').toLowerCase()
  return extension === outputFormat || container.includes(outputFormat)
}

function compatibleWithWebm(format: VideoFormat): boolean {
  const videoCodec = normalizeCodec(format.videoCodec)
  const audioCodec = normalizeCodec(format.audioCodec)
  const videoOk =
    !videoCodec ||
    videoCodec === 'none' ||
    videoCodec.includes('vp9') ||
    videoCodec.includes('vp8') ||
    videoCodec.includes('av01') ||
    videoCodec.includes('av1')
  const audioOk =
    !audioCodec ||
    audioCodec === 'none' ||
    audioCodec.includes('opus') ||
    audioCodec.includes('vorbis')
  return videoOk && audioOk
}

function compatibleWithMp4(format: VideoFormat): boolean {
  const videoCodec = normalizeCodec(format.videoCodec)
  const audioCodec = normalizeCodec(format.audioCodec)
  const videoOk =
    !videoCodec ||
    videoCodec === 'none' ||
    videoCodec.includes('h264') ||
    videoCodec.includes('avc') ||
    videoCodec.includes('h265') ||
    videoCodec.includes('hevc') ||
    videoCodec.includes('av01') ||
    videoCodec.includes('av1')
  const audioOk =
    !audioCodec ||
    audioCodec === 'none' ||
    audioCodec.includes('aac') ||
    audioCodec.includes('mp4a') ||
    audioCodec.includes('mp3')
  return videoOk && audioOk
}

function compatibleWithMov(format: VideoFormat): boolean {
  const videoCodec = normalizeCodec(format.videoCodec)
  const audioCodec = normalizeCodec(format.audioCodec)
  const videoOk =
    !videoCodec ||
    videoCodec === 'none' ||
    videoCodec.includes('h264') ||
    videoCodec.includes('avc') ||
    videoCodec.includes('h265') ||
    videoCodec.includes('hevc') ||
    PRORES_CODEC_MARKERS.some((marker) => videoCodec.includes(marker))
  const audioOk =
    !audioCodec ||
    audioCodec === 'none' ||
    audioCodec.includes('aac') ||
    audioCodec.includes('mp4a') ||
    audioCodec.includes('alac') ||
    audioCodec.includes('pcm') ||
    audioCodec.includes('mp3')
  return videoOk && audioOk
}

function findBestFormat(
  metadata: VideoMetadata,
  settings: ExportSettings
): VideoFormat | undefined {
  const maxHeight = settings.resolution === 'auto' ? Infinity : settings.resolution
  return [...metadata.formats]
    .filter((format) => format.height == null || format.height <= maxHeight)
    .sort((a, b) => (b.height ?? 0) - (a.height ?? 0))
    .find((format) => format.videoCodec !== 'none')
}

function requiresCodecConversion(
  format: VideoFormat | undefined,
  settings: ExportSettings
): boolean {
  if (!format) {
    return false
  }

  const videoNeedsConversion =
    settings.videoCodec !== 'auto' && !codecMatches(format.videoCodec, settings.videoCodec)
  const audioNeedsConversion =
    settings.audioCodec !== 'auto' && !codecMatches(format.audioCodec, settings.audioCodec)

  return videoNeedsConversion || audioNeedsConversion
}

function makeFormatSelector(settings: ExportSettings): string {
  if (isAudioOnlyFormat(settings.outputFormat)) {
    return 'bestaudio/best'
  }

  const heightFilter = settings.resolution === 'auto' ? '' : `[height<=${settings.resolution}]`
  return `bestvideo${heightFilter}+bestaudio/best${heightFilter}/best`
}

export function createDownloadPlan(
  metadata: VideoMetadata,
  settings: ExportSettings
): DownloadPlan {
  const bestFormat = findBestFormat(metadata, settings)
  const codecConversion = requiresCodecConversion(bestFormat, settings)
  const audioOnly = isAudioOnlyFormat(settings.outputFormat)
  const frameRateConversion = settings.frameRate !== 'auto'
  const bitrateConversion = settings.audioBitrate !== 'auto' || settings.videoBitrate !== 'auto'
  const webmCodecMismatch =
    settings.outputFormat === 'webm' && bestFormat != null && !compatibleWithWebm(bestFormat)
  const mp4CodecMismatch =
    settings.outputFormat === 'mp4' && bestFormat != null && !compatibleWithMp4(bestFormat)
  const movCodecMismatch =
    settings.outputFormat === 'mov' && bestFormat != null && !compatibleWithMov(bestFormat)

  if (
    audioOnly ||
    codecConversion ||
    frameRateConversion ||
    bitrateConversion ||
    webmCodecMismatch ||
    mp4CodecMismatch ||
    movCodecMismatch
  ) {
    return {
      strategy: 'transcode',
      formatSelector: makeFormatSelector(settings),
      targetExtension: settings.outputFormat,
      needsFfmpegTranscode: true,
      selectedHeight: settings.resolution === 'auto' ? undefined : settings.resolution
    }
  }

  if (bestFormat && containerMatches(bestFormat, settings.outputFormat)) {
    return {
      strategy: 'direct',
      formatSelector: makeFormatSelector(settings),
      targetExtension: settings.outputFormat,
      needsFfmpegTranscode: false,
      ytdlpMergeFormat: settings.outputFormat,
      selectedHeight: settings.resolution === 'auto' ? undefined : settings.resolution
    }
  }

  return {
    strategy: 'remux',
    formatSelector: makeFormatSelector(settings),
    targetExtension: settings.outputFormat,
    needsFfmpegTranscode: false,
    ytdlpMergeFormat: settings.outputFormat,
    selectedHeight: settings.resolution === 'auto' ? undefined : settings.resolution
  }
}
