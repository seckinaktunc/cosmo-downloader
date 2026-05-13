import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDisplayMetadata } from '../../hooks/useDisplayMetadata';
import { renderFormattedDescription } from '../../lib/descriptionFormatter';
import { getHistoryQueueAction } from '../../lib/historyEntryActions';
import { readValidClipboardUrl } from '../../lib/urlInput';
import { useDownloadStore } from '../../stores/downloadStore';
import { useHistoryStore } from '../../stores/historyStore';
import { useQueueStore } from '../../stores/queueStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUiStore } from '../../stores/uiStore';
import { useVideoStore } from '../../stores/videoStore';
import Icon from '../miscellaneous/Icon';
import { PlatformBadge } from '../miscellaneous/PlatformBadge';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Thumbnail } from '../ui/Thumbnail';

export function MetadataPanel(): React.JSX.Element {
  const { t } = useTranslation();
  const previewMetadata = useVideoStore((state) => state.metadata);
  const metadata = useDisplayMetadata();
  const stage = useVideoStore((state) => state.stage);
  const error = useVideoStore((state) => state.error);
  const retryMetadata = useVideoStore((state) => state.retryMetadata);
  const setUrl = useVideoStore((state) => state.setUrl);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const settings = useSettingsStore((state) => state.settings);
  const previewExportSettings = useUiStore((state) => state.previewExportSettings);
  const activeExportTarget = useUiStore((state) => state.activeExportTarget);
  const resetDownload = useDownloadStore((state) => state.reset);
  const historyEntries = useHistoryStore((state) => state.entries);
  const activeQueueItemId = useQueueStore((state) => state.activeItemId);
  const queueItems = useQueueStore((state) => state.items);
  const addToQueue = useQueueStore((state) => state.add);
  const requeue = useHistoryStore((state) => state.requeue);
  const openMediaPanel = useUiStore((state) => state.openMediaPanel);
  const activeHistoryEntry =
    activeExportTarget?.type === 'history'
      ? historyEntries.find((entry) => entry.id === activeExportTarget.entryId)
      : undefined;
  const activeHistoryQueueAction = activeHistoryEntry
    ? getHistoryQueueAction(activeHistoryEntry.status)
    : null;
  const refreshClipboardUrl = useCallback(async (): Promise<string | null> => {
    const nextClipboardUrl = await readValidClipboardUrl();
    setClipboardUrl(nextClipboardUrl);
    return nextClipboardUrl;
  }, []);

  useEffect(() => {
    const refresh = (): void => {
      void refreshClipboardUrl();
    };
    const timer = window.setTimeout(refresh, 0);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [refreshClipboardUrl]);

  const handlePaste = async (): Promise<void> => {
    const nextClipboardUrl = clipboardUrl ?? (await refreshClipboardUrl());
    if (!nextClipboardUrl) {
      return;
    }

    setUrl(nextClipboardUrl);
    if (!activeQueueItemId) {
      resetDownload();
    }
  };

  if (!metadata) {
    const isFetching = stage === 'fetching_metadata';
    const isFailed = stage === 'failed';
    const shouldShowRetry = !isFetching && isFailed && error;
    const shouldShowPaste = !isFetching && !error && !isFailed;
    const pasteDisabled = !settings || clipboardUrl == null;
    const pasteTooltip =
      settings && clipboardUrl == null ? t('actions.copyVideoUrlFirst') : undefined;

    return (
      <section className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <Icon
          name={stage === 'fetching_metadata' ? 'spinner' : 'copy'}
          size={96}
          thickness={1}
          className={`opacity-50`}
        />
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-2xl font-bold text-white">
            {stage === 'fetching_metadata' ? t('metadata.fetching') : t('metadata.emptyTitle')}
          </h1>
          {error ? (
            <div className="flex flex-col items-center gap-3">
              <p className="max-w-xl text-sm text-white/50">{error}</p>
            </div>
          ) : (
            stage !== 'fetching_metadata' && (
              <p className="max-w-xl text-sm text-white/50">{t('metadata.emptySubtitle')}</p>
            )
          )}
          {shouldShowRetry && (
            <Button
              variant="secondary"
              icon="reload"
              label={t('queue.actions.retry')}
              size="sm"
              className="mt-4"
              disabled={!settings}
              onClick={() => settings && void retryMetadata(settings)}
            />
          )}

          {shouldShowPaste && (
            <Button
              variant="secondary"
              icon="paste"
              label={t('actions.pasteToBegin')}
              size="sm"
              className="mt-4"
              disabled={pasteDisabled}
              tooltip={pasteTooltip}
              onClick={() => void handlePaste()}
            />
          )}
        </div>
      </section>
    );
  }

  const sourceUrl = metadata.webpageUrl ?? metadata.url;
  const isDuplicate = queueItems.some(
    (item) => (item.metadata.webpageUrl ?? item.metadata.url) === sourceUrl
  );
  const addCurrentToQueue = async (): Promise<void> => {
    if (!settings || !previewMetadata) return;

    const added = await addToQueue(previewMetadata, previewExportSettings, settings);
    if (added) {
      openMediaPanel('queue');
    }
  };

  const requestAddToQueue = (): void => {
    if (isDuplicate) {
      setConfirmDuplicate(true);
      return;
    }

    void addCurrentToQueue();
  };

  return (
    <section className="flex flex-col h-full text-white divide-y divide-white/10">
      <Thumbnail
        src={metadata.thumbnail}
        title={metadata.title}
        duration={metadata.duration}
        className="aspect-video shrink-0"
        placeholderClassName="min-h-64"
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col divide-y divide-white/10">
        <div className="flex min-w-0 shrink-0 flex-col gap-1 p-4">
          <PlatformBadge
            platform={metadata.platform}
            className="text-sm font-bold uppercase tracking-wide text-primary"
          />
          <a
            href={metadata?.webpageUrl}
            target="_blank"
            rel="noreferrer"
            className="block max-w-full truncate font-bold underline-offset-2 hover:underline text-white"
          >
            {metadata.title}
          </a>
          {metadata.uploaderUrl ? (
            <a
              href={metadata.uploaderUrl}
              target="_blank"
              rel="noreferrer"
              className="block max-w-full truncate text-sm underline-offset-2 hover:underline text-white/50"
            >
              {metadata.uploader ?? t('metadata.unknownUploader')}
            </a>
          ) : (
            <span className="block max-w-full truncate text-sm text-white/50">
              {metadata.uploader ?? t('metadata.unknownUploader')}
            </span>
          )}
        </div>

        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 text-sm leading-relaxed text-white/70 wrap-break-word select-text">
          {metadata.description && renderFormattedDescription(metadata.description)}
        </div>

        {activeHistoryEntry ? (
          activeHistoryQueueAction ? (
            <div className="shrink-0">
              <Button
                icon="add"
                label={
                  activeHistoryQueueAction === 'download'
                    ? t('history.actions.download')
                    : t('history.actions.requeue')
                }
                size="lg"
                className="w-full rounded-none border-none"
                onClick={() => void requeue(activeHistoryEntry.id)}
              />
            </div>
          ) : null
        ) : activeExportTarget?.type === 'queue' ? null : previewMetadata ? (
          <div className="shrink-0">
            <Button
              variant="secondary"
              icon="add"
              label={t('queue.add')}
              size="full-lg"
              className="border-none"
              disabled={!settings}
              onClick={requestAddToQueue}
              ripple
            />
          </div>
        ) : null}
      </div>

      {confirmDuplicate ? (
        <ConfirmDialog
          title={t('queue.duplicateTitle')}
          message={t('queue.duplicateMessage')}
          confirmLabel={t('queue.addDuplicate')}
          cancelLabel={t('actions.cancel')}
          onCancel={() => setConfirmDuplicate(false)}
          onConfirm={() => {
            setConfirmDuplicate(false);
            void addCurrentToQueue();
          }}
        />
      ) : null}
    </section>
  );
}
