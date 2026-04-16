import { useEffect, useState } from 'react'
import type { VideoMetadata } from '../../../../shared/types'
import { getBottomButtonState } from '../../lib/bottomButtonState'
import { formatDuration } from '../../lib/formatters'
import { useDownloadStore } from '../../stores/downloadStore'
import { useQueueStore } from '../../stores/queueStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useUiStore } from '../../stores/uiStore'
import { useVideoStore } from '../../stores/videoStore'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'

function getSourceUrl(metadata: VideoMetadata): string {
  return metadata.webpageUrl ?? metadata.url
}

export function BottomBar(): React.JSX.Element {
  const [confirmDuplicate, setConfirmDuplicate] = useState(false)
  const metadata = useVideoStore((state) => state.metadata)
  const videoStage = useVideoStore((state) => state.stage)
  const clearVideo = useVideoStore((state) => state.clear)
  const settings = useSettingsStore((state) => state.settings)
  const previewExportSettings = useUiStore((state) => state.previewExportSettings)
  const activePanel = useUiStore((state) => state.activePanel)
  const setActivePanel = useUiStore((state) => state.setActivePanel)
  const activeContent = useUiStore((state) => state.activeContent)
  const downloadStage = useDownloadStore((state) => state.stage)
  const progress = useDownloadStore((state) => state.progress)
  const cancelDownload = useDownloadStore((state) => state.cancel)
  const resetDownload = useDownloadStore((state) => state.reset)
  const trackedPreviewQueueItemId = useDownloadStore((state) => state.trackedPreviewQueueItemId)
  const completedPreviewUrl = useDownloadStore((state) => state.completedPreviewUrl)
  const trackPreviewDownload = useDownloadStore((state) => state.trackPreviewDownload)
  const markTrackedPreviewCompleted = useDownloadStore((state) => state.markTrackedPreviewCompleted)
  const clearPreviewDownloadState = useDownloadStore((state) => state.clearPreviewDownloadState)
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
  const pendingItems = queueItems.filter((item) => item.status === 'pending')
  const hasPendingQueueItems = pendingItems.length > 0
  const currentSourceUrl = metadata ? getSourceUrl(metadata) : undefined
  const currentPreviewCompleted = Boolean(
    currentSourceUrl && completedPreviewUrl === currentSourceUrl
  )
  const completedPreviewItem =
    currentSourceUrl && currentPreviewCompleted
      ? queueItems.find(
          (item) => item.status === 'completed' && getSourceUrl(item.metadata) === currentSourceUrl
        )
      : undefined
  const buttonText = getBottomButtonState({
    activeItem,
    queueItems,
    downloadStage,
    progress,
    videoStage,
    canDownloadPreview: canDownload,
    currentPreviewCompleted,
    hasPendingQueueItems
  })
  const activeProgress = activeItem?.progress ?? completedPreviewItem?.progress ?? progress
  const isActive = buttonText.mode === 'cancel'
  const percent =
    isActive || currentPreviewCompleted
      ? (activeProgress?.percentage ?? (currentPreviewCompleted ? 100 : 0))
      : 0
  const isDuplicate =
    metadata != null &&
    queueItems.some((item) => getSourceUrl(item.metadata) === getSourceUrl(metadata))

  useEffect(() => {
    if (!trackedPreviewQueueItemId) {
      return
    }

    const trackedItem = queueItems.find((item) => item.id === trackedPreviewQueueItemId)
    if (trackedItem?.status === 'completed') {
      markTrackedPreviewCompleted(trackedItem.id)
    }
  }, [markTrackedPreviewCompleted, queueItems, trackedPreviewQueueItemId])

  const clearCurrent = (): void => {
    clearVideo()
    resetDownload()
    clearPreviewDownloadState()
  }

  const addPreviewAndStart = async (): Promise<void> => {
    if (!metadata || !settings) {
      return
    }

    const added = await addToQueue(metadata, previewExportSettings, settings)
    if (added) {
      trackPreviewDownload(added.id, getSourceUrl(metadata))
      await startQueue()
      setActivePanel('queue')
    }
  }

  const handleMainClick = (): void => {
    if (buttonText.mode === 'cancel') {
      void (activeItem ? cancelActive() : cancelDownload())
      return
    }

    if (buttonText.mode === 'new_video') {
      clearCurrent()
      return
    }

    if (buttonText.mode === 'start' && canDownload && !currentPreviewCompleted) {
      if (isDuplicate) {
        setConfirmDuplicate(true)
        return
      }

      void addPreviewAndStart()
      return
    }

    if (buttonText.mode === 'start' && hasPendingQueueItems) {
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
          icon={
            buttonText.mode === 'cancel'
              ? 'close'
              : buttonText.mode === 'new_video'
                ? 'reload'
                : 'download'
          }
          label={buttonText.primary}
          active={activeContent === 'export'}
          disabled={buttonText.mode === 'disabled'}
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
