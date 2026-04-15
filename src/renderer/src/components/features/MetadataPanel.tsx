import { formatDuration } from '@renderer/lib/formatters'
import { useState } from 'react'
import { renderFormattedDescription } from '../../lib/descriptionFormatter'
import { useQueueStore } from '../../stores/queueStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useUiStore } from '../../stores/uiStore'
import { useVideoStore } from '../../stores/videoStore'
import Icon from '../miscellaneous/Icon'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'

export function MetadataPanel(): React.JSX.Element {
  const metadata = useVideoStore((state) => state.metadata)
  const stage = useVideoStore((state) => state.stage)
  const error = useVideoStore((state) => state.error)
  const [confirmDuplicate, setConfirmDuplicate] = useState(false)
  const settings = useSettingsStore((state) => state.settings)
  const exportSettings = useUiStore((state) => state.exportSettings)
  const queueItems = useQueueStore((state) => state.items)
  const addToQueue = useQueueStore((state) => state.add)
  const setActivePanel = useUiStore((state) => state.setActivePanel)

  if (!metadata) {
    return (
      <section className="flex h-full flex-col items-center justify-center gap-3 text-center text-white/50">
        <Icon
          name={stage === 'fetching_metadata' ? 'spinner' : 'video'}
          size={48}
          className={stage === 'fetching_metadata' ? 'animate-spin' : undefined}
        />
        <div>
          <h1 className="text-2xl font-bold text-white">
            {stage === 'fetching_metadata' ? 'Fetching metadata' : 'Paste a single video link'}
          </h1>
          <p className="mt-1 max-w-xl text-sm">{error ?? 'Or drag and drop here'}</p>
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

    const added = await addToQueue(metadata, exportSettings, settings)
    if (added) {
      setActivePanel('queue')
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
    <section className="flex flex-col h-full text-white">
      <div className="relative aspect-video overflow-hidden bg-white/5 border-b border-white/10 shrink-0">
        {metadata.thumbnail ? (
          <img
            src={metadata.thumbnail}
            alt=""
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full min-h-64 items-center justify-center">
            <Icon name="video" size={64} className="opacity-50" />
          </div>
        )}
        {metadata?.duration && (
          <span className="absolute bottom-1 right-1 bg-black/50 px-1 py-0.5 rounded-sm text-sm font-bold">
            {formatDuration(metadata.duration)}
          </span>
        )}
        <div className="opacity-0 hover:opacity-100 absolute flex inset-0 w-full h-full justify-center items-center bg-black/90">
          <Button
            icon="download"
            onlyIcon
            ghost
            label={'Download thumbnail'}
            tooltip="Download thumbnail"
            size="xl"
          />
          <Button
            icon="external"
            onlyIcon
            ghost
            label={'Open thumbnail in browser'}
            tooltip="Open thumbnail in browser"
            size="xl"
          />
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
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
          <a
            href={metadata?.uploader}
            target="_blank"
            rel="noreferrer"
            className="block max-w-full truncate text-sm underline-offset-2 hover:underline text-white/50"
          >
            {metadata.uploader ?? 'Unknown uploader'}
          </a>
        </div>

        {metadata.description ? (
          <div className="min-h-0 flex-1 overflow-y-auto border-t border-white/10 p-4 text-sm leading-relaxed text-white/70">
            {renderFormattedDescription(metadata.description)}
          </div>
        ) : null}

        <div className="shrink-0 border-t border-white/10">
          <Button
            icon="add"
            label="Add to Queue"
            size="lg"
            className="w-full rounded-none"
            disabled={!settings}
            onClick={requestAddToQueue}
          />
        </div>
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
            void addCurrentToQueue()
          }}
        />
      ) : null}
    </section>
  )
}
