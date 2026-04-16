import { useUiStore } from '@renderer/stores/uiStore'
import type { DownloadHistoryEntry } from '../../../../shared/types'
import { formatDuration } from '../../lib/formatters'
import { useHistoryStore } from '../../stores/historyStore'
import type { ActionMenuItem } from '../ui/ActionMenu'
import { InteractiveItemPanel } from '../ui/InteractiveItemPanel'

export function HistoryPanel(): React.JSX.Element {
  const entries = useHistoryStore((state) => state.entries)
  const remove = useHistoryStore((state) => state.remove)
  const removeMany = useHistoryStore((state) => state.removeMany)
  const clear = useHistoryStore((state) => state.clear)
  const requeue = useHistoryStore((state) => state.requeue)
  const openOutput = useHistoryStore((state) => state.openOutput)
  const copySource = useHistoryStore((state) => state.copySource)
  const activeExportTarget = useUiStore((state) => state.activeExportTarget)
  const setActiveExportTarget = useUiStore((state) => state.setActiveExportTarget)
  const setActiveContent = useUiStore((state) => state.setActiveContent)
  const setActivePanel = useUiStore((state) => state.setActivePanel)

  const getActions = (entry: DownloadHistoryEntry): ActionMenuItem[] => [
    {
      id: 'open',
      label: 'Open',
      icon: 'folder',
      disabled: !entry.outputPath,
      onSelect: () => void openOutput(entry.id)
    },
    {
      id: 'requeue',
      label: 'Requeue',
      icon: 'add',
      onSelect: () => void requeue(entry.id)
    },
    {
      id: 'copy-source',
      label: 'Copy URL',
      icon: 'copy',
      onSelect: () => void copySource(entry.id)
    },
    {
      id: 'remove',
      label: 'Remove',
      icon: 'trash',
      danger: true,
      onSelect: () => void remove(entry.id)
    }
  ]

  return (
    <InteractiveItemPanel
      title="Download History"
      subtitle={entries.length === 0 ? 'No downloads' : `${entries.length} downloaded item(s)`}
      items={entries}
      getId={(entry) => entry.id}
      getTitle={(entry) => entry.metadata.title}
      getThumbnail={(entry) => entry.metadata.thumbnail}
      getThumbnailBadge={(entry) =>
        entry.metadata.duration ? formatDuration(entry.metadata.duration) : undefined
      }
      getLeadingLabel={(entry) => entry.status}
      getMetaLabel={(entry) => new Date(entry.createdAt).toLocaleString()}
      getDetail={(entry) =>
        entry.error ?? entry.outputPath ?? entry.metadata.uploader ?? 'No details'
      }
      getActions={getActions}
      activeItemId={activeExportTarget?.type === 'history' ? activeExportTarget.entryId : undefined}
      onActivateItem={(entry) => {
        setActiveExportTarget({ type: 'history', entryId: entry.id })
        setActiveContent('export')
      }}
      onDeleteSelected={(entryIds) => void removeMany(entryIds)}
      onClear={() => void clear()}
      onClose={() => setActivePanel('metadata')}
    />
  )
}
