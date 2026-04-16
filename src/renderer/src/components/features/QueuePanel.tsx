import { useUiStore } from '@renderer/stores/uiStore'
import { movePendingItems } from '../../../../shared/queueModel'
import type { QueueItem } from '../../../../shared/types'
import { formatPercent, formatTransferDetail } from '../../lib/formatters'
import { useQueueStore } from '../../stores/queueStore'
import { InteractiveItemPanel } from '../ui/InteractiveItemPanel'
import type { ActionMenuItem } from '../ui/ActionMenu'

function statusLabel(item: QueueItem): string {
  if (item.status === 'active') {
    const percent = formatPercent(item.progress?.percentage)
    return percent ? `Active ${percent}` : 'Active'
  }

  return item.status.charAt(0).toUpperCase() + item.status.slice(1)
}

export function QueuePanel(): React.JSX.Element {
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
  const setActivePanel = useUiStore((state) => state.setActivePanel)

  const getActions = (item: QueueItem): ActionMenuItem[] => {
    const actions: ActionMenuItem[] = []

    if (item.status === 'failed' || item.status === 'cancelled' || item.status === 'paused') {
      actions.push({
        id: 'retry',
        label: 'Retry',
        icon: 'reload',
        onSelect: () => void retry(item.id)
      })
    }

    if (item.status === 'active') {
      actions.push({
        id: 'cancel',
        label: 'Cancel',
        icon: 'close',
        danger: true,
        onSelect: () => void cancelActive()
      })
    }

    if (item.status !== 'active') {
      actions.push({
        id: 'remove',
        label: 'Remove',
        icon: 'trash',
        danger: true,
        onSelect: () => void remove(item.id)
      })
    }

    return actions
  }

  return (
    <InteractiveItemPanel
      title="Queue"
      subtitle={items.length === 0 ? 'No queued downloads' : `${items.length} queued item(s)`}
      items={items}
      getId={(item) => item.id}
      getTitle={(item) => item.metadata.title}
      getThumbnail={(item) => item.metadata.thumbnail}
      getLeadingLabel={(_item, index) => `#${index + 1}`}
      getStatusLabel={statusLabel}
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
      onClear={() => void clear()}
      onClose={() => setActivePanel('metadata')}
    />
  )
}
