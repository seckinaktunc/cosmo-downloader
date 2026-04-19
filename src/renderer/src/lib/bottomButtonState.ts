import type { DownloadProgress, DownloadStage, QueueItem } from '../../../shared/types'
import { formatPercent, formatStageHeadline, formatTransferDetail } from './formatters'

const ACTIVE_STAGES: DownloadStage[] = ['downloading', 'processing']

export type BottomButtonMode = 'cancel' | 'start' | 'new_video' | 'disabled'

export type BottomButtonStateInput = {
  activeItem?: QueueItem
  queueItems: QueueItem[]
  downloadStage: DownloadStage
  progress: DownloadProgress | null
  videoStage: DownloadStage
  canDownloadPreview: boolean
  currentPreviewCompleted: boolean
  hasPendingQueueItems: boolean
  queueStartCount?: number
  labels?: {
    startDownload: string
    startQueue: (count: number) => string
    newVideo: string
    fetchingMetadata: string
    queueProgress: (index: number, total: number, percent: string) => string
  }
}

export type BottomButtonState = {
  mode: BottomButtonMode
  primary: string
  secondary?: string
}

export function getBottomButtonState({
  activeItem,
  queueItems,
  downloadStage,
  progress,
  videoStage,
  canDownloadPreview,
  currentPreviewCompleted,
  hasPendingQueueItems,
  queueStartCount,
  labels = {
    startDownload: 'Start Download',
    startQueue: (count) => `Start Queue (${count})`,
    newVideo: 'New Video',
    fetchingMetadata: 'Fetching Metadata',
    queueProgress: (index, total, percent) => `Queue ${index} of ${total} (${percent})`
  }
}: BottomButtonStateInput): BottomButtonState {
  if (activeItem) {
    const index = queueItems.findIndex((item) => item.id === activeItem.id)
    const percent = formatPercent(activeItem.progress?.percentage) || '0%'
    return {
      mode: 'cancel',
      primary: labels.queueProgress(index + 1, queueItems.length, percent),
      secondary: formatTransferDetail(activeItem.progress)
    }
  }

  if (ACTIVE_STAGES.includes(downloadStage)) {
    return {
      mode: 'cancel',
      primary: formatStageHeadline(progress, downloadStage),
      secondary: formatTransferDetail(progress)
    }
  }

  if (hasPendingQueueItems) {
    return { mode: 'start', primary: labels.startQueue(queueStartCount ?? queueItems.length) }
  }

  if (currentPreviewCompleted) {
    return { mode: 'new_video', primary: labels.newVideo }
  }

  if (canDownloadPreview) {
    return { mode: 'start', primary: labels.startDownload }
  }

  if (videoStage === 'fetching_metadata') {
    return { mode: 'disabled', primary: labels.fetchingMetadata }
  }

  return { mode: 'disabled', primary: labels.startDownload }
}
