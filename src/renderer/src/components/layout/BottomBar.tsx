import { useState } from 'react'
import type { QueueItem, VideoMetadata } from '../../../../shared/types'
import {
  formatDuration,
  formatPercent,
  formatStageHeadline,
  formatTransferDetail
} from '../../lib/formatters'
import { useDownloadStore } from '../../stores/downloadStore'
import { useQueueStore } from '../../stores/queueStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useUiStore } from '../../stores/uiStore'
import { useVideoStore } from '../../stores/videoStore'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'

const ACTIVE_STAGES = ['downloading', 'processing']
const TERMINAL_QUEUE_STATES = ['completed', 'failed', 'cancelled']

function getSourceUrl(metadata: VideoMetadata): string {
  return metadata.webpageUrl ?? metadata.url
}

function getPrimaryText(
  activeItem: QueueItem | undefined,
  queueItems: QueueItem[],
  downloadStage: ReturnType<typeof useDownloadStore.getState>['stage'],
  progress: ReturnType<typeof useDownloadStore.getState>['progress'],
  videoStage: ReturnType<typeof useVideoStore.getState>['stage'],
  canDownload: boolean
): { primary: string; secondary?: string } {
  if (activeItem) {
    const index = queueItems.findIndex((item) => item.id === activeItem.id)
    const percent = formatPercent(activeItem.progress?.percentage) || '0%'
    return {
      primary: `Queue ${index + 1} of ${queueItems.length} (${percent})`,
      secondary: formatTransferDetail(activeItem.progress)
    }
  }

  if (ACTIVE_STAGES.includes(downloadStage)) {
    return {
      primary: formatStageHeadline(progress, downloadStage),
      secondary: formatTransferDetail(progress)
    }
  }

  if (
    downloadStage === 'completed' ||
    (queueItems.length > 0 &&
      queueItems.every((item) => TERMINAL_QUEUE_STATES.includes(item.status)))
  ) {
    return { primary: 'Download New' }
  }

  if (videoStage === 'fetching_metadata') {
    return { primary: 'Fetching Metadata' }
  }

  if (canDownload) {
    return { primary: 'Download Video' }
  }

  if (videoStage === 'failed') {
    return { primary: 'Download Unavailable' }
  }

  return { primary: 'Paste Video URL' }
}

export function BottomBar(): React.JSX.Element {
  const [confirmDuplicate, setConfirmDuplicate] = useState(false)
  const metadata = useVideoStore((state) => state.metadata)
  const videoStage = useVideoStore((state) => state.stage)
  const clearVideo = useVideoStore((state) => state.clear)
  const settings = useSettingsStore((state) => state.settings)
  const exportSettings = useUiStore((state) => state.exportSettings)
  const activePanel = useUiStore((state) => state.activePanel)
  const setActivePanel = useUiStore((state) => state.setActivePanel)
  const activeContent = useUiStore((state) => state.activeContent)
  const downloadStage = useDownloadStore((state) => state.stage)
  const progress = useDownloadStore((state) => state.progress)
  const resetDownload = useDownloadStore((state) => state.reset)
  const queueItems = useQueueStore((state) => state.items)
  const activeQueueItemId = useQueueStore((state) => state.activeItemId)
  const queuePaused = useQueueStore((state) => state.paused)
  const addToQueue = useQueueStore((state) => state.add)
  const startQueue = useQueueStore((state) => state.start)
  const resumeQueue = useQueueStore((state) => state.resume)
  const cancelActive = useQueueStore((state) => state.cancelActive)
  const activeItem = queueItems.find((item) => item.id === activeQueueItemId)
  const summaryMetadata = activeItem?.metadata ?? metadata
  const canDownload = metadata != null && settings != null && videoStage === 'ready'
  const hasQueue = queueItems.length > 0
  const buttonText = getPrimaryText(
    activeItem,
    queueItems,
    downloadStage,
    progress,
    videoStage,
    canDownload
  )
  const activeProgress = activeItem?.progress ?? progress
  const isActive = activeItem != null || ACTIVE_STAGES.includes(downloadStage)
  const isComplete =
    downloadStage === 'completed' ||
    (queueItems.length > 0 &&
      queueItems.every((item) => TERMINAL_QUEUE_STATES.includes(item.status)))
  const percent =
    isActive || isComplete ? (activeProgress?.percentage ?? (isComplete ? 100 : 0)) : 0
  const isDuplicate =
    metadata != null &&
    queueItems.some((item) => getSourceUrl(item.metadata) === getSourceUrl(metadata))

  const clearCurrent = (): void => {
    clearVideo()
    resetDownload()
  }

  const addPreviewAndStart = async (): Promise<void> => {
    if (!metadata || !settings) {
      return
    }

    const added = await addToQueue(metadata, exportSettings, settings)
    if (added) {
      await startQueue()
      setActivePanel('queue')
    }
  }

  const handleMainClick = (): void => {
    if (activeItem) {
      void cancelActive()
      return
    }

    if (isComplete) {
      clearCurrent()
      return
    }

    if (canDownload) {
      if (isDuplicate) {
        setConfirmDuplicate(true)
        return
      }

      void addPreviewAndStart()
      return
    }

    if (hasQueue) {
      void (queuePaused ? resumeQueue() : startQueue())
    }
  }

  return (
    <footer className="grid grid-cols-[1fr_auto] items-center gap-y-2 bg-black p-2">
      <div className="flex min-w-0 max-w-[75%] items-center gap-3">
        <div className="relative aspect-video h-16 overflow-hidden rounded-lg bg-white/10 shrink-0">
          {summaryMetadata?.thumbnail ? (
            <img
              src={summaryMetadata.thumbnail}
              alt=""
              className="size-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : null}
          {summaryMetadata?.duration ? (
            <span className="absolute bottom-1 right-1 bg-black/50 px-1 py-0.5 rounded-sm text-sm font-bold">
              {formatDuration(summaryMetadata.duration)}
            </span>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col items-start">
          {summaryMetadata?.platform ? (
            <span className="text-sm font-bold uppercase tracking-wide text-primary">
              {summaryMetadata.platform}
            </span>
          ) : null}
          <a
            href={summaryMetadata?.webpageUrl}
            target="_blank"
            rel="noreferrer"
            className="block max-w-full truncate font-bold underline-offset-2 hover:underline text-white"
          >
            {summaryMetadata?.title ?? 'No video selected'}
          </a>
          <a
            href={summaryMetadata?.uploader}
            target="_blank"
            rel="noreferrer"
            className="block max-w-full truncate text-sm underline-offset-2 hover:underline text-white/50"
          >
            {summaryMetadata?.uploader ?? 'Paste a video link to begin'}
          </a>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          icon={activeItem ? 'close' : isComplete ? 'reload' : 'download'}
          label={buttonText.primary}
          active={activeContent === 'export'}
          disabled={!canDownload && !isActive && !isComplete && !hasQueue}
          onClick={handleMainClick}
          size="xl"
          aria-label={buttonText.primary}
          className="min-w-48"
        >
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate">{buttonText.primary}</span>
            {buttonText.secondary ? (
              <span className="truncate text-xs font-normal opacity-70">
                {buttonText.secondary}
              </span>
            ) : null}
          </span>
        </Button>
        <Button
          icon="list"
          label="Queue"
          tooltip="Queue"
          onlyIcon
          active={activePanel === 'queue'}
          onClick={() => setActivePanel(activePanel === 'queue' ? null : 'queue')}
          size="xl"
        />
      </div>

      <div className="col-span-3 h-2 overflow-hidden rounded-lg bg-white/10">
        <div
          className="h-full rounded-lg bg-primary transition-all"
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>

      {confirmDuplicate ? (
        <ConfirmDialog
          title="Add duplicate?"
          message="This video is already in the queue. Add another copy with the current settings?"
          confirmLabel="Add Duplicate"
          cancelLabel="Cancel"
          onCancel={() => setConfirmDuplicate(false)}
          onConfirm={() => {
            setConfirmDuplicate(false)
            void addPreviewAndStart()
          }}
        />
      ) : null}
    </footer>
  )
}
