import type { DownloadProgress, DownloadStage } from '../../../shared/types'

export function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) {
    return 'Unknown duration'
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  const parts = hours > 0 ? [hours, minutes, remainingSeconds] : [minutes, remainingSeconds]
  return parts.map((part) => String(part).padStart(2, '0')).join(':')
}

export function formatBytes(bytes?: number): string {
  if (bytes == null || bytes < 0) {
    return ''
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }

  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

export function formatPercent(value?: number): string {
  if (value == null || !Number.isFinite(value)) {
    return ''
  }

  return `${Math.round(Math.max(0, Math.min(100, value)))}%`
}

function formatStage(stage: DownloadStage): string {
  return stage
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

export function formatStageHeadline(
  progress: DownloadProgress | null | undefined,
  fallbackStage: DownloadStage
): string {
  const stage = progress?.stage ?? fallbackStage
  const label = progress?.stageLabel ?? formatStage(stage)
  const percent = formatPercent(progress?.percentage)

  if ((stage === 'downloading' || stage === 'processing') && percent) {
    return `${label} (${percent})`
  }

  return label
}

export function formatTransferDetail(progress: DownloadProgress | null | undefined): string {
  if (!progress) {
    return ''
  }

  if (progress.downloadedBytes != null && progress.totalBytes != null) {
    return `${formatBytes(progress.downloadedBytes)} of ${formatBytes(progress.totalBytes)}`
  }

  if (progress.downloadedBytes != null) {
    return `${formatBytes(progress.downloadedBytes)} downloaded`
  }

  if (progress.speed && progress.eta) {
    return `${progress.speed}, ETA ${progress.eta}`
  }

  if (progress.eta) {
    return `ETA ${progress.eta}`
  }

  if (progress.message) {
    return progress.message
  }

  if (progress.stage === 'downloading') {
    return 'Preparing'
  }

  if (progress.stage === 'processing') {
    return 'Processing media'
  }

  return ''
}

export function formatResolution(value?: number): string {
  if (!value) {
    return 'Unknown'
  }

  if (value >= 2160) return '2160p 4K'
  if (value >= 1440) return '1440p 2K'
  return `${value}p`
}
