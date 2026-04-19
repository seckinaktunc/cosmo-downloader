import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { VideoMetadata } from '../../../../shared/types'
import { useDisplayMetadata } from '../../hooks/useDisplayMetadata'
import { getBottomButtonState } from '../../lib/bottomButtonState'
import { useDownloadStore } from '../../stores/downloadStore'
import { useQueueStore } from '../../stores/queueStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useUiStore } from '../../stores/uiStore'
import { useVideoStore } from '../../stores/videoStore'
import { Button } from '../ui/Button'
import { Thumbnail } from '../ui/Thumbnail'

function getSourceUrl(metadata: VideoMetadata): string {
  return metadata.webpageUrl ?? metadata.url
}

export function BottomBar(): React.JSX.Element {
  const { t } = useTranslation()
  const metadata = useVideoStore((state) => state.metadata)
  const displayMetadata = useDisplayMetadata()
  const videoStage = useVideoStore((state) => state.stage)
  const clearVideo = useVideoStore((state) => state.clear)
  const settings = useSettingsStore((state) => state.settings)
  const chooseOutputPath = useSettingsStore((state) => state.chooseOutputPath)
  const previewExportSettings = useUiStore((state) => state.previewExportSettings)
  const updatePreviewExportSettings = useUiStore((state) => state.updatePreviewExportSettings)
  const activePanel = useUiStore((state) => state.activePanel)
  const openMediaPanel = useUiStore((state) => state.openMediaPanel)
  const toggleMediaPanel = useUiStore((state) => state.toggleMediaPanel)
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
  const flushExportSettingsSaves = useQueueStore((state) => state.flushExportSettingsSaves)
  const activeItem = queueItems.find((item) => item.id === activeQueueItemId)
  const summaryMetadata = activeItem?.metadata ?? displayMetadata ?? metadata
  const canDownload = metadata != null && settings != null && videoStage === 'ready'
  const pendingItems = queueItems.filter((item) => item.status === 'pending')
  const hasPendingQueueItems = pendingItems.length > 0
  const currentSourceUrl = metadata ? getSourceUrl(metadata) : undefined
  const isDuplicate =
    metadata != null &&
    queueItems.some((item) => getSourceUrl(item.metadata) === getSourceUrl(metadata))
  const currentPreviewCompleted = Boolean(
    currentSourceUrl && completedPreviewUrl === currentSourceUrl
  )
  const willAddPreviewToQueue = canDownload && !currentPreviewCompleted && !isDuplicate
  const queueStartCount = hasPendingQueueItems
    ? queueItems.length + (willAddPreviewToQueue ? 1 : 0)
    : undefined
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
    hasPendingQueueItems,
    queueStartCount,
    labels: {
      startDownload: t('bottom.startDownload'),
      startQueue: (count) => t('bottom.startQueue', { count }),
      newVideo: t('bottom.newVideo'),
      fetchingMetadata: t('metadata.fetching'),
      queueProgress: (index, total, progressPercent) =>
        t('bottom.queueProgress', { index, total, percent: progressPercent })
    }
  })
  const activeProgress = activeItem?.progress ?? completedPreviewItem?.progress ?? progress
  const isActive = buttonText.mode === 'cancel'
  const percent =
    isActive || currentPreviewCompleted
      ? (activeProgress?.percentage ?? (currentPreviewCompleted ? 100 : 0))
      : 0
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

    let exportSettings = previewExportSettings
    if (settings.alwaysAskDownloadLocation && !exportSettings.savePath) {
      const savePath = await chooseOutputPath({
        title: metadata.title,
        outputFormat: exportSettings.outputFormat
      })

      if (!savePath) {
        return
      }

      exportSettings = updatePreviewExportSettings({ savePath })
    }

    const added = await addToQueue(metadata, exportSettings, settings)
    if (added) {
      trackPreviewDownload(added.id, getSourceUrl(metadata))
      await flushExportSettingsSaves()
      await startQueue()
      openMediaPanel('queue')
    }
  }

  const startExistingQueue = async (): Promise<void> => {
    await flushExportSettingsSaves()
    await (queuePaused ? resumeQueue() : startQueue())
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

    if (buttonText.mode === 'start' && hasPendingQueueItems) {
      if (canDownload && !currentPreviewCompleted && !isDuplicate) {
        void addPreviewAndStart()
        return
      }

      void startExistingQueue()
      return
    }

    if (buttonText.mode === 'start' && canDownload && !currentPreviewCompleted) {
      void addPreviewAndStart()
    }
  }

  return (
    <footer className="grid grid-cols-[1fr_auto] items-center gap-y-2 bg-black p-2">
      <div className="flex min-w-0 max-w-[75%] items-center gap-3">
        <Thumbnail
          src={summaryMetadata?.thumbnail}
          title={summaryMetadata?.title}
          duration={summaryMetadata?.duration}
          className="aspect-video h-16 rounded-lg bg-white/10 shrink-0 border border-white/10"
          actionSize="xs"
          showPlaceholderIcon={false}
          actionsEnabled={false}
          onClick={() => openMediaPanel('metadata')}
        />
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
            {summaryMetadata?.title ?? t('bottom.noVideo')}
          </a>
          {summaryMetadata?.uploaderUrl ? (
            <a
              href={summaryMetadata.uploaderUrl}
              target="_blank"
              rel="noreferrer"
              className="block max-w-full truncate text-sm underline-offset-2 hover:underline text-white/50"
            >
              {summaryMetadata.uploader ?? t('bottom.pasteToBegin')}
            </a>
          ) : (
            <span className="block max-w-full truncate text-sm text-white/50">
              {summaryMetadata?.uploader ?? t('bottom.pasteToBegin')}
            </span>
          )}
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
          label={t('queue.title')}
          tooltip={t('queue.title')}
          onlyIcon
          active={activePanel === 'queue'}
          onClick={() => toggleMediaPanel('queue')}
          size="xl"
        />
      </div>

      <div className="col-span-3 h-2 overflow-hidden rounded-lg bg-white/10 border border-white/10">
        <div
          className="h-full rounded-lg bg-linear-to-r from-primary/50 to-primary bg-no-repeat transition-all"
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
    </footer>
  )
}
