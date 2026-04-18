import { useUiStore } from '@renderer/stores/uiStore'
import { useTranslation } from 'react-i18next'
import { movePendingItems } from '../../../../shared/queueModel'
import type { QueueItem } from '../../../../shared/types'
import { formatPercent, formatTransferDetail } from '../../lib/formatters'
import { useQueueStore } from '../../stores/queueStore'
import { InteractiveItemPanel } from '../ui/InteractiveItemPanel'
import type { ActionMenuItem } from '../ui/ActionMenu'

function statusLabel(
  item: QueueItem,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  if (item.status === 'active') {
    const percent = formatPercent(item.progress?.percentage)
    return percent ? t('queue.status.activePercent', { percent }) : t('queue.status.active')
  }

  return t(`queue.status.${item.status}`)
}

export function QueuePanel(): React.JSX.Element {
  const { t } = useTranslation()
  const items = useQueueStore((state) => state.items)
  const cancelActive = useQueueStore((state) => state.cancelActive)
  const remove = useQueueStore((state) => state.remove)
  const removeMany = useQueueStore((state) => state.removeMany)
  const retry = useQueueStore((state) => state.retry)
  const moveMany = useQueueStore((state) => state.moveMany)
  const clear = useQueueStore((state) => state.clear)
  const activeExportTarget = useUiStore((state) => state.activeExportTarget)
  const setActiveExportTarget = useUiStore((state) => state.setActiveExportTarget)
  const setActiveContent = useUiStore((state) => state.setActiveContent)
  const closeMediaPanel = useUiStore((state) => state.closeMediaPanel)

  const getActions = (item: QueueItem): ActionMenuItem[] => {
    const actions: ActionMenuItem[] = []

    if (item.status === 'failed' || item.status === 'cancelled' || item.status === 'paused') {
      actions.push({
        id: 'retry',
        label: t('queue.actions.retry'),
        icon: 'reload',
        onSelect: () => void retry(item.id)
      })
    }

    if (item.status === 'active') {
      actions.push({
        id: 'cancel',
        label: t('actions.cancel'),
        icon: 'close',
        danger: true,
        onSelect: () => void cancelActive()
      })
    }

    if (item.status !== 'active') {
      actions.push({
        id: 'remove',
        label: t('queue.actions.remove'),
        icon: 'trash',
        danger: true,
        onSelect: () => void remove(item.id)
      })
    }

    return actions
  }

  return (
    <InteractiveItemPanel
      title={t('queue.title')}
      subtitle={
        items.length === 0 ? t('queue.empty') : t('queue.itemCount', { count: items.length })
      }
      items={items}
      getId={(item) => item.id}
      getTitle={(item) => item.metadata.title}
      getThumbnail={(item) => item.metadata.thumbnail}
      getLeadingLabel={(_item, index) => `#${index + 1}`}
      getStatusLabel={(item) => statusLabel(item, t)}
      getDetail={(item) => item.error ?? formatTransferDetail(item.progress)}
      getActions={getActions}
      activeItemId={activeExportTarget?.type === 'queue' ? activeExportTarget.itemId : undefined}
      onActivateItem={(item) => {
        setActiveExportTarget({ type: 'queue', itemId: item.id })
        setActiveContent('export')
      }}
      isBulkSelectable={(item) => item.status !== 'active'}
      isDraggable={(item) => item.status === 'pending'}
      previewMoveItems={(currentItems, itemIds, targetIndex) =>
        movePendingItems(currentItems, itemIds, targetIndex)
      }
      moveItems={(itemIds, targetIndex) => void moveMany(itemIds, targetIndex)}
      onDeleteSelected={(itemIds) => void removeMany(itemIds)}
      onClearSelection={() => {
        if (activeExportTarget?.type === 'queue') {
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
      menuLabel={t('queue.itemActions')}
    />
  )
}
