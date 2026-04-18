import { useUiStore } from '@renderer/stores/uiStore'
import { useTranslation } from 'react-i18next'
import type { DownloadHistoryEntry } from '../../../../shared/types'
import { formatDuration } from '../../lib/formatters'
import { useHistoryStore } from '../../stores/historyStore'
import type { ActionMenuItem } from '../ui/ActionMenu'
import { InteractiveItemPanel } from '../ui/InteractiveItemPanel'
import type { ThumbnailAction } from '../ui/Thumbnail'

export function HistoryPanel(): React.JSX.Element {
  const { t } = useTranslation()
  const entries = useHistoryStore((state) => state.entries)
  const remove = useHistoryStore((state) => state.remove)
  const removeMany = useHistoryStore((state) => state.removeMany)
  const clear = useHistoryStore((state) => state.clear)
  const requeue = useHistoryStore((state) => state.requeue)
  const openMedia = useHistoryStore((state) => state.openMedia)
  const openFolder = useHistoryStore((state) => state.openFolder)
  const copySource = useHistoryStore((state) => state.copySource)
  const activeExportTarget = useUiStore((state) => state.activeExportTarget)
  const setActiveExportTarget = useUiStore((state) => state.setActiveExportTarget)
  const setActiveContent = useUiStore((state) => state.setActiveContent)
  const closeMediaPanel = useUiStore((state) => state.closeMediaPanel)

  const getActions = (entry: DownloadHistoryEntry): ActionMenuItem[] => [
    {
      id: 'open',
      label: t('history.actions.openMedia'),
      icon: 'video',
      disabled: !entry.outputPath,
      onSelect: () => void openMedia(entry.id)
    },
    {
      id: 'open-folder',
      label: t('history.actions.openFolder'),
      icon: 'folderOpen',
      disabled: !entry.outputPath,
      onSelect: () => void openFolder(entry.id)
    },
    {
      id: 'requeue',
      label: t('history.actions.requeue'),
      icon: 'add',
      onSelect: () => void requeue(entry.id)
    },
    {
      id: 'copy-source',
      label: t('history.actions.copyUrl'),
      icon: 'copy',
      onSelect: () => void copySource(entry.id)
    },
    {
      id: 'remove',
      label: t('queue.actions.remove'),
      icon: 'trash',
      danger: true,
      onSelect: () => void remove(entry.id)
    }
  ]

  const getThumbnailActions = (entry: DownloadHistoryEntry): ThumbnailAction[] => [
    {
      id: 'open-media',
      label: t('history.actions.openMedia'),
      icon: 'video',
      disabled: !entry.outputPath,
      feedbackLabel: t('thumbnail.opened'),
      onSelect: () => openMedia(entry.id)
    },
    {
      id: 'open-folder',
      label: t('history.actions.openFolder'),
      icon: 'folderOpen',
      disabled: !entry.outputPath,
      feedbackLabel: t('thumbnail.opened'),
      onSelect: () => openFolder(entry.id)
    },
    {
      id: 'remove',
      label: t('queue.actions.remove'),
      icon: 'trash',
      feedbackLabel: t('thumbnail.removed'),
      onSelect: async () => {
        await remove(entry.id)
        return true
      }
    }
  ]

  return (
    <InteractiveItemPanel
      title={t('history.title')}
      subtitle={
        entries.length === 0
          ? t('history.empty')
          : t('history.itemCount', { count: entries.length })
      }
      items={entries}
      getId={(entry) => entry.id}
      getTitle={(entry) => entry.metadata.title}
      getThumbnail={(entry) => entry.metadata.thumbnail}
      getThumbnailActions={getThumbnailActions}
      getThumbnailBadge={(entry) =>
        entry.metadata.duration ? formatDuration(entry.metadata.duration) : undefined
      }
      getLeadingLabel={(entry) => t(`history.status.${entry.status}`)}
      getMetaLabel={(entry) => new Date(entry.createdAt).toLocaleString()}
      getDetail={(entry) =>
        entry.error ?? entry.outputPath ?? entry.metadata.uploader ?? t('common.noDetails')
      }
      getActions={getActions}
      activeItemId={activeExportTarget?.type === 'history' ? activeExportTarget.entryId : undefined}
      onActivateItem={(entry) => {
        setActiveExportTarget({ type: 'history', entryId: entry.id })
        setActiveContent('export')
      }}
      onDeleteSelected={(entryIds) => void removeMany(entryIds)}
      onClearSelection={() => {
        if (activeExportTarget?.type === 'history') {
          setActiveExportTarget(null)
        }
      }}
      onClear={() => void clear()}
      onClose={closeMediaPanel}
      emptyDetail={t('common.noDetails')}
      clearLabel={t('actions.clear')}
      deleteLabel={(count) => t('actions.deleteCount', { count })}
      closeLabel={t('actions.close')}
      actionsLabel={(title) => t('actions.itemActions', { title })}
      menuLabel={t('history.itemActions')}
    />
  )
}
