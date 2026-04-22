import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDisplayMetadata } from '../../hooks/useDisplayMetadata'
import { renderFormattedDescription } from '../../lib/descriptionFormatter'
import { useHistoryStore } from '../../stores/historyStore'
import { useQueueStore } from '../../stores/queueStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useUiStore } from '../../stores/uiStore'
import { useVideoStore } from '../../stores/videoStore'
import Icon from '../miscellaneous/Icon'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Thumbnail } from '../ui/Thumbnail'

export function MetadataPanel(): React.JSX.Element {
  const { t } = useTranslation()
  const previewMetadata = useVideoStore((state) => state.metadata)
  const metadata = useDisplayMetadata()
  const stage = useVideoStore((state) => state.stage)
  const error = useVideoStore((state) => state.error)
  const [confirmDuplicate, setConfirmDuplicate] = useState(false)
  const settings = useSettingsStore((state) => state.settings)
  const chooseOutputPath = useSettingsStore((state) => state.chooseOutputPath)
  const previewExportSettings = useUiStore((state) => state.previewExportSettings)
  const updatePreviewExportSettings = useUiStore((state) => state.updatePreviewExportSettings)
  const activeExportTarget = useUiStore((state) => state.activeExportTarget)
  const queueItems = useQueueStore((state) => state.items)
  const addToQueue = useQueueStore((state) => state.add)
  const requeue = useHistoryStore((state) => state.requeue)
  const openMediaPanel = useUiStore((state) => state.openMediaPanel)

  if (!metadata) {
    return (
      <section className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <Icon
          name={stage === 'fetching_metadata' ? 'spinner' : 'copy'}
          size={96}
          thickness={1}
          className={`opacity-50`}
        />
        <div>
          <h1 className="text-2xl font-bold text-white">
            {stage === 'fetching_metadata' ? t('metadata.fetching') : t('metadata.emptyTitle')}
          </h1>
          {error ? (
            <p className="mt-1 max-w-xl text-sm text-white/50">{error}</p>
          ) : (
            stage !== 'fetching_metadata' && (
              <p className="mt-1 max-w-xl text-sm text-white/50">{t('metadata.emptySubtitle')}</p>
            )
          )}
        </div>
      </section>
    )
  }

  const sourceUrl = metadata.webpageUrl ?? metadata.url
  const isDuplicate = queueItems.some(
    (item) => (item.metadata.webpageUrl ?? item.metadata.url) === sourceUrl
  )
  const addCurrentToQueue = async (): Promise<void> => {
    if (!settings) {
      return
    }

    if (!previewMetadata) {
      return
    }

    let exportSettings = previewExportSettings
    if (settings.alwaysAskDownloadLocation && !exportSettings.savePath) {
      const savePath = await chooseOutputPath({
        title: previewMetadata.title,
        outputFormat: exportSettings.outputFormat
      })

      if (!savePath) {
        return
      }

      exportSettings = updatePreviewExportSettings({ savePath })
    }

    const added = await addToQueue(previewMetadata, exportSettings, settings)
    if (added) {
      openMediaPanel('queue')
    }
  }

  const requestAddToQueue = (): void => {
    if (isDuplicate) {
      setConfirmDuplicate(true)
      return
    }

    void addCurrentToQueue()
  }

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
          {metadata.platform ? (
            <span className="text-sm font-bold uppercase tracking-wide text-primary">
              {metadata.platform}
            </span>
          ) : null}
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

        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 text-sm leading-relaxed text-white/70 wrap-break-word">
          {metadata.description && renderFormattedDescription(metadata.description)}
        </div>

        {activeExportTarget?.type === 'history' ? (
          <div className="shrink-0">
            <Button
              icon="add"
              label={t('history.actions.requeue')}
              size="lg"
              className="w-full rounded-none border-none"
              onClick={() => void requeue(activeExportTarget.entryId)}
            />
          </div>
        ) : activeExportTarget?.type === 'queue' ? null : previewMetadata ? (
          <div className="shrink-0">
            <Button
              icon="add"
              label={t('queue.add')}
              size="lg"
              className="w-full rounded-none border-none"
              disabled={!settings}
              onClick={requestAddToQueue}
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
            setConfirmDuplicate(false)
            void addCurrentToQueue()
          }}
        />
      ) : null}
    </section>
  )
}
