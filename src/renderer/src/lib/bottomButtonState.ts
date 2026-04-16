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
  hasPendingQueueItems
}: BottomButtonStateInput): BottomButtonState {
  if (activeItem) {
    const index = queueItems.findIndex((item) => item.id === activeItem.id)
    const percent = formatPercent(activeItem.progress?.percentage) || '0%'
    return {
      mode: 'cancel',
      primary: `Queue ${index + 1} of ${queueItems.length} (${percent})`,
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
    return { mode: 'start', primary: 'Start Download' }
  }

  if (currentPreviewCompleted) {
    return { mode: 'new_video', primary: 'New Video' }
  }

  if (canDownloadPreview) {
    return { mode: 'start', primary: 'Start Download' }
  }

  if (videoStage === 'fetching_metadata') {
    return { mode: 'disabled', primary: 'Fetching Metadata' }
  }

  return { mode: 'disabled', primary: 'Start Download' }
}
