import { useUiStore } from '@renderer/stores/uiStore'
import { formatDuration } from '../../lib/formatters'
import { useHistoryStore } from '../../stores/historyStore'
import { Button } from '../ui/Button'

export function HistoryPanel(): React.JSX.Element {
  const entries = useHistoryStore((state) => state.entries)
  const remove = useHistoryStore((state) => state.remove)
  const clear = useHistoryStore((state) => state.clear)
  const requeue = useHistoryStore((state) => state.requeue)
  const openOutput = useHistoryStore((state) => state.openOutput)
  const copySource = useHistoryStore((state) => state.copySource)
  const setActivePanel = useUiStore((state) => state.setActivePanel)

  return (
    <section className="grid gap-4 text-white">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-white/10 bg-black/70 p-4 backdrop-blur">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold">Download History</h2>
          <p className="truncate text-sm text-white/50">
            {entries.length === 0 ? 'No downloads' : `${entries.length} downloaded item(s)`}
          </p>
        </div>
        <div className="flex shrink-0">
          <Button
            icon="close"
            label={`Close`}
            className="absolute top-2 right-1"
            onlyIcon
            ghost
            onClick={() => setActivePanel('metadata')}
          />
        </div>
      </div>

      <div className="grid gap-2">
        {entries.map((entry) => (
          <article
            key={entry.id}
            className="grid gap-3 rounded-lg border border-white/10 bg-white/5 p-3"
          >
            <div className="flex gap-3">
              <div className="relative aspect-video h-16 shrink-0 overflow-hidden rounded-md bg-white/10">
                {entry.metadata.thumbnail ? (
                  <img
                    src={entry.metadata.thumbnail}
                    alt=""
                    className="size-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : null}
                {entry.metadata.duration ? (
                  <span className="absolute bottom-1 right-1 rounded-sm bg-black/60 px-1 text-xs font-bold">
                    {formatDuration(entry.metadata.duration)}
                  </span>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase text-primary">{entry.status}</span>
                  <span className="text-xs text-white/40">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </div>
                <h3 className="truncate font-bold">{entry.metadata.title}</h3>
                <p className="truncate text-sm text-white/50">
                  {entry.error ?? entry.outputPath ?? entry.metadata.uploader ?? 'No details'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-1">
              <Button
                icon="folder"
                label="Open"
                size="xs"
                ghost
                disabled={!entry.outputPath}
                onClick={() => void openOutput(entry.id)}
              />
              <Button
                icon="add"
                label="Requeue"
                size="xs"
                ghost
                onClick={() => void requeue(entry.id)}
              />
              <Button
                icon="copy"
                label="Copy URL"
                size="xs"
                ghost
                onClick={() => void copySource(entry.id)}
              />
              <Button
                icon="trash"
                label="Remove"
                size="xs"
                ghost
                onClick={() => void remove(entry.id)}
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
