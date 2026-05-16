import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { isHistoryEntryEditable } from '../../../../shared/historyEntryCapabilities';
import { useDisplayMetadata } from '../../hooks/useDisplayMetadata';
import { getBottomButtonState } from '../../lib/bottomButtonState';
import { useDownloadStore } from '../../stores/downloadStore';
import { useHistoryStore } from '../../stores/historyStore';
import { useQueueStore } from '../../stores/queueStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUiStore } from '../../stores/uiStore';
import { useVideoStore } from '../../stores/videoStore';
import { PlatformBadge } from '../miscellaneous/PlatformBadge';
import { Button } from '../ui/Button';
import { Thumbnail } from '../ui/Thumbnail';
import { getSourceUrl } from '@renderer/lib/utils';

export function BottomBar(): React.JSX.Element {
  const { t } = useTranslation();
  const metadata = useVideoStore((state) => state.metadata);
  const displayMetadata = useDisplayMetadata();
  const videoStage = useVideoStore((state) => state.stage);
  const clearVideo = useVideoStore((state) => state.clear);
  const settings = useSettingsStore((state) => state.settings);
  const previewExportSettings = useUiStore((state) => state.previewExportSettings);
  const activeExportTarget = useUiStore((state) => state.activeExportTarget);
  const activePanel = useUiStore((state) => state.activePanel);
  const openMediaPanel = useUiStore((state) => state.openMediaPanel);
  const toggleMediaPanel = useUiStore((state) => state.toggleMediaPanel);
  const activeContent = useUiStore((state) => state.activeContent);
  const downloadStage = useDownloadStore((state) => state.stage);
  const progress = useDownloadStore((state) => state.progress);
  const cancelDownload = useDownloadStore((state) => state.cancel);
  const resetDownload = useDownloadStore((state) => state.reset);
  const trackedPreviewQueueItemId = useDownloadStore((state) => state.trackedPreviewQueueItemId);
  const completedPreviewUrl = useDownloadStore((state) => state.completedPreviewUrl);
  const trackPreviewDownload = useDownloadStore((state) => state.trackPreviewDownload);
  const markTrackedPreviewCompleted = useDownloadStore(
    (state) => state.markTrackedPreviewCompleted
  );
  const clearPreviewDownloadState = useDownloadStore((state) => state.clearPreviewDownloadState);
  const historyEntries = useHistoryStore((state) => state.entries);
  const requeueHistoryEntry = useHistoryStore((state) => state.requeue);
  const startHistoryDownload = useHistoryStore((state) => state.startDownload);
  const flushHistoryExportSettingsSaves = useHistoryStore(
    (state) => state.flushExportSettingsSaves
  );
  const queueItems = useQueueStore((state) => state.items);
  const activeQueueItemId = useQueueStore((state) => state.activeItemId);
  const queueProgressById = useQueueStore((state) => state.progressById);
  const queuePaused = useQueueStore((state) => state.paused);
  const addToQueue = useQueueStore((state) => state.add);
  const startQueue = useQueueStore((state) => state.start);
  const resumeQueue = useQueueStore((state) => state.resume);
  const cancelActive = useQueueStore((state) => state.cancelActive);
  const flushExportSettingsSaves = useQueueStore((state) => state.flushExportSettingsSaves);
  const activeItem = queueItems.find((item) => item.id === activeQueueItemId);
  const activeQueueProgress = activeItem ? queueProgressById[activeItem.id] : undefined;
  const activeQueueItem = activeItem
    ? {
        ...activeItem,
        progress: activeQueueProgress
      }
    : undefined;
  const activeHistoryEntry =
    activeExportTarget?.type === 'history'
      ? historyEntries.find((entry) => entry.id === activeExportTarget.entryId)
      : undefined;
  const canDownloadHistorySelection = Boolean(
    activeHistoryEntry && isHistoryEntryEditable(activeHistoryEntry.status)
  );
  const historySelectionActive = activeExportTarget?.type === 'history';
  const summaryMetadata = activeItem?.metadata ?? displayMetadata ?? metadata;
  const canDownload =
    metadata != null && settings != null && videoStage === 'ready' && !historySelectionActive;
  const pendingItems = queueItems.filter((item) => item.status === 'pending');
  const hasPendingQueueItems = pendingItems.length > 0;
  const currentSourceUrl = metadata ? getSourceUrl(metadata) : undefined;
  const isDuplicate =
    metadata != null &&
    !historySelectionActive &&
    queueItems.some((item) => getSourceUrl(item.metadata) === getSourceUrl(metadata));
  const currentPreviewCompleted = Boolean(
    !historySelectionActive && currentSourceUrl && completedPreviewUrl === currentSourceUrl
  );
  const willAddHistoryToQueue = hasPendingQueueItems && canDownloadHistorySelection;
  const willAddPreviewToQueue =
    !willAddHistoryToQueue && canDownload && !currentPreviewCompleted && !isDuplicate;
  const queueStartCount = hasPendingQueueItems
    ? queueItems.length + (willAddHistoryToQueue || willAddPreviewToQueue ? 1 : 0)
    : undefined;
  const completedPreviewItem =
    currentSourceUrl && currentPreviewCompleted
      ? queueItems.find(
          (item) => item.status === 'completed' && getSourceUrl(item.metadata) === currentSourceUrl
        )
      : undefined;
  const buttonText = getBottomButtonState({
        activeItem: activeQueueItem,
        queueItems,
        downloadStage,
        progress,
        videoStage,
        canDownloadHistorySelection,
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
  });
  const activeProgress = activeQueueProgress ?? completedPreviewItem?.progress ?? progress;
  const isActive = buttonText.mode === 'cancel';
  const percent =
    isActive || currentPreviewCompleted
      ? (activeProgress?.percentage ?? (currentPreviewCompleted ? 100 : 0))
      : 0;
  useEffect(() => {
    if (!trackedPreviewQueueItemId) {
      return;
    }

    const trackedItem = queueItems.find((item) => item.id === trackedPreviewQueueItemId);
    if (trackedItem?.status === 'completed') {
      markTrackedPreviewCompleted(trackedItem.id);
    }
  }, [markTrackedPreviewCompleted, queueItems, trackedPreviewQueueItemId]);

  const clearCurrent = (): void => {
    clearVideo();
    resetDownload();
    clearPreviewDownloadState();
  };

  const addPreviewAndStart = async (): Promise<void> => {
    if (!metadata || !settings) return;

    const added = await addToQueue(metadata, previewExportSettings, settings);
    if (added) {
      trackPreviewDownload(added.id, getSourceUrl(metadata));
      await flushExportSettingsSaves();
      await startQueue();
      openMediaPanel('queue');
    }
  };

  const startOrResumeQueue = async (): Promise<void> => {
    await (queuePaused ? resumeQueue() : startQueue());
  };

  const addHistoryToQueueAndStart = async (): Promise<void> => {
    if (!activeHistoryEntry) {
      return;
    }

    await Promise.all([flushExportSettingsSaves(), flushHistoryExportSettingsSaves()]);
    const added = await requeueHistoryEntry(activeHistoryEntry.id);
    if (!added) {
      return;
    }

    await startOrResumeQueue();
    openMediaPanel('queue');
  };

  const startSelectedHistoryDownload = async (): Promise<void> => {
    if (!activeHistoryEntry) {
      return;
    }

    const started = await startHistoryDownload(activeHistoryEntry.id);
    if (!started) {
      return;
    }
  };

  const startExistingQueue = async (): Promise<void> => {
    await flushExportSettingsSaves();
    await startOrResumeQueue();
  };

  const handleMainClick = (): void => {
    if (buttonText.mode === 'cancel') {
      void (activeItem ? cancelActive() : cancelDownload());
      return;
    }

    if (buttonText.mode === 'new_video') {
      clearCurrent();
      return;
    }

    if (buttonText.mode === 'start' && hasPendingQueueItems) {
      if (canDownloadHistorySelection) {
        void addHistoryToQueueAndStart();
        return;
      }

      if (canDownload && !currentPreviewCompleted && !isDuplicate) {
        void addPreviewAndStart();
        return;
      }

      void startExistingQueue();
      return;
    }

    if (buttonText.mode === 'start' && canDownloadHistorySelection) {
      void startSelectedHistoryDownload();
      return;
    }

    if (buttonText.mode === 'start' && canDownload && !currentPreviewCompleted) {
      void addPreviewAndStart();
    }
  };

  return (
    <footer className="grid grid-cols-[1fr_auto] items-center gap-y-2 bg-black p-2">
      <div className="flex min-w-0 max-w-lg items-center gap-3">
        <Thumbnail
          src={summaryMetadata?.thumbnail}
          title={summaryMetadata?.title}
          duration={summaryMetadata?.duration}
          className="aspect-video h-16 rounded-lg bg-gray-900 shrink-0 border border-white/10"
          actionSize="xs"
          showPlaceholderIcon={false}
          actionsEnabled={false}
          onClick={() => openMediaPanel('metadata')}
        />
        <div className="flex min-w-0 flex-col items-start">
          <PlatformBadge
            platform={summaryMetadata?.platform}
            className="text-sm font-bold uppercase tracking-wide text-primary"
          />
          <a
            href={summaryMetadata?.webpageUrl}
            target="_blank"
            rel="noreferrer"
            className="block max-w-full truncate font-bold underline-offset-2 hover:underline text-white"
          >
            {summaryMetadata?.title ?? <div className="h-4 w-40 bg-gray-900 rounded-lg mb-1" />}
          </a>
          {summaryMetadata?.uploaderUrl ? (
            <a
              href={summaryMetadata.uploaderUrl}
              target="_blank"
              rel="noreferrer"
              className="block max-w-full truncate text-sm underline-offset-2 hover:underline text-white/50"
            >
              {summaryMetadata.uploader ?? <div className="h-4 w-24 bg-gray-900/50 rounded-lg" />}
            </a>
          ) : (
            <span className="block max-w-full truncate text-sm text-white/50">
              {summaryMetadata?.uploader ?? <div className="h-4 w-24 bg-gray-900/50 rounded-lg" />}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          icon={
            videoStage === 'fetching_metadata'
              ? 'spinner'
              : buttonText.mode === 'cancel'
                ? 'close'
                : buttonText.mode === 'new_video'
                  ? 'reload'
                  : 'appIcon'
          }
          label={buttonText.primary}
          isActive={activeContent === 'exportSettings'}
          disabled={buttonText.mode === 'disabled'}
          onClick={handleMainClick}
          size="xl"
          aria-label={buttonText.primary}
          className="min-w-48"
          rounded
          ripple
        >
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate">{buttonText.primary}</span>
            {buttonText.secondary && (
              <span className="truncate text-xs font-normal text-black/50">
                {buttonText.secondary}
              </span>
            )}
          </span>
        </Button>
        <Button
          variant="secondary"
          icon="list"
          label={t('queue.title')}
          tooltip={t('queue.title')}
          isActive={activePanel === 'queue'}
          onClick={() => toggleMediaPanel('queue')}
          size="icon-xl"
          rounded
          ripple
        />
      </div>

      <div className="col-span-3 h-2 overflow-hidden rounded-lg bg-gray-900 border border-white/10">
        <div
          className="h-full rounded-lg bg-linear-to-r from-primary/50 to-primary bg-no-repeat transition-all"
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
    </footer>
  );
}
