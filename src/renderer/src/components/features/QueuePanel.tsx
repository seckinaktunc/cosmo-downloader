import { useUiStore } from '@renderer/stores/uiStore'
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { movePendingItems } from '../../../../shared/queueModel'
import type { QueueItem } from '../../../../shared/types'
import { formatPercent, formatTransferDetail } from '../../lib/formatters'
import { cn } from '../../lib/utils'
import { useQueueStore } from '../../stores/queueStore'
import Icon from '../miscellaneous/Icon'
import { Button } from '../ui/Button'

const DRAG_THRESHOLD_PX = 6
const AUTO_SCROLL_EDGE_PX = 48
const AUTO_SCROLL_STEP_PX = 12

type DragState = {
  itemId: string
  itemIds: string[]
  pointerId: number
  startX: number
  startY: number
  originalIndex: number
  targetIndex: number
  dragging: boolean
  cancelClick: boolean
}

type QueueItemActionMenuProps = {
  item: QueueItem
  onCancel: () => void
  onClose: () => void
  onRemove: () => void
  onRetry: () => void
}

function statusLabel(item: QueueItem): string {
  if (item.status === 'active') {
    const percent = formatPercent(item.progress?.percentage)
    return percent ? `Active ${percent}` : 'Active'
  }

  return item.status.charAt(0).toUpperCase() + item.status.slice(1)
}

function getTargetIndex(
  clientY: number,
  items: QueueItem[],
  listElement: HTMLElement
): number | null {
  const rows = Array.from(listElement.querySelectorAll<HTMLElement>('[data-queue-item-id]'))
  if (rows.length === 0) {
    return null
  }

  const rawIndex = rows.findIndex((row) => {
    const rect = row.getBoundingClientRect()
    return clientY < rect.top + rect.height / 2
  })
  const targetIndex = rawIndex < 0 ? rows.length - 1 : rawIndex
  if (items[targetIndex]?.status === 'pending') {
    return targetIndex
  }

  const pendingIndexes = items
    .map((item, index) => (item.status === 'pending' ? index : -1))
    .filter((index) => index >= 0)
  if (pendingIndexes.length === 0) {
    return null
  }

  return pendingIndexes.reduce((closest, index) =>
    Math.abs(index - targetIndex) < Math.abs(closest - targetIndex) ? index : closest
  )
}

function QueueItemActionMenu({
  item,
  onCancel,
  onClose,
  onRemove,
  onRetry
}: QueueItemActionMenuProps): React.JSX.Element | null {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const canRetry =
    item.status === 'failed' || item.status === 'cancelled' || item.status === 'paused'
  const canCancel = item.status === 'active'
  const canRemove = item.status !== 'active'

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) {
        onClose()
      }
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  if (!canRetry && !canCancel && !canRemove) {
    return null
  }

  return (
    <div
      ref={rootRef}
      className="absolute left-8 top-8 z-50 min-w-36 overflow-hidden border border-white/10 bg-dark shadow-2xl shadow-black/40"
      role="menu"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {canRetry ? (
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white focus:outline-none"
          role="menuitem"
          onClick={() => {
            onRetry()
            onClose()
          }}
        >
          <Icon name="reload" size={16} />
          Retry
        </button>
      ) : null}
      {canCancel ? (
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white focus:outline-none"
          role="menuitem"
          onClick={() => {
            onCancel()
            onClose()
          }}
        >
          <Icon name="close" size={16} />
          Cancel
        </button>
      ) : null}
      {canRemove ? (
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white focus:outline-none"
          role="menuitem"
          onClick={() => {
            onRemove()
            onClose()
          }}
        >
          <Icon name="trash" size={16} />
          Remove
        </button>
      ) : null}
    </div>
  )
}

export function QueuePanel(): React.JSX.Element {
  const items = useQueueStore((state) => state.items)
  const cancelActive = useQueueStore((state) => state.cancelActive)
  const remove = useQueueStore((state) => state.remove)
  const removeMany = useQueueStore((state) => state.removeMany)
  const retry = useQueueStore((state) => state.retry)
  const moveMany = useQueueStore((state) => state.moveMany)
  const clear = useQueueStore((state) => state.clear)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [dragItems, setDragItems] = useState<QueueItem[] | null>(null)
  const [draggingItemIds, setDraggingItemIds] = useState<string[]>([])
  const [autoScrollDirection, setAutoScrollDirection] = useState<-1 | 0 | 1>(0)
  const listRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<DragState | null>(null)
  const displayItems = dragItems ?? items
  const setActivePanel = useUiStore((state) => state.setActivePanel)

  const selectableIds = useMemo(
    () => new Set(items.filter((item) => item.status !== 'active').map((item) => item.id)),
    [items]
  )
  const visibleSelectedIds = useMemo(
    () => Array.from(selectedIds).filter((id) => selectableIds.has(id)),
    [selectableIds, selectedIds]
  )
  const selectedCount = visibleSelectedIds.length

  useEffect(() => {
    if (draggingItemIds.length === 0 || autoScrollDirection === 0) {
      return undefined
    }

    const timer = window.setInterval(() => {
      if (listRef.current) {
        listRef.current.scrollTop += autoScrollDirection * AUTO_SCROLL_STEP_PX
      }
    }, 16)

    return () => window.clearInterval(timer)
  }, [autoScrollDirection, draggingItemIds.length])

  const toggleSelected = (item: QueueItem): void => {
    if (item.status === 'active') {
      return
    }

    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(item.id)) {
        next.delete(item.id)
      } else {
        next.add(item.id)
      }
      return next
    })
  }

  const deleteSelected = async (): Promise<void> => {
    await removeMany(visibleSelectedIds)
    setSelectedIds(new Set())
  }

  const removeItem = async (itemId: string): Promise<void> => {
    await remove(itemId)
    setSelectedIds((current) => {
      const next = new Set(current)
      next.delete(itemId)
      return next
    })
  }

  const getDragItemIds = (item: QueueItem): string[] => {
    if (item.status !== 'pending') {
      return []
    }

    if (!selectedIds.has(item.id)) {
      return [item.id]
    }

    return items
      .filter((candidate) => candidate.status === 'pending' && selectedIds.has(candidate.id))
      .map((candidate) => candidate.id)
  }

  const clearSelectionFromBlankSpace = (event: PointerEvent<HTMLElement>): void => {
    if (dragStateRef.current || event.target !== event.currentTarget) {
      return
    }

    setSelectedIds(new Set())
  }

  const beginPointerGesture = (
    event: PointerEvent<HTMLElement>,
    item: QueueItem,
    index: number
  ): void => {
    if (event.button !== 0 || item.status === 'active') {
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    dragStateRef.current = {
      itemId: item.id,
      itemIds: getDragItemIds(item),
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originalIndex: index,
      targetIndex: index,
      dragging: false,
      cancelClick: false
    }
  }

  const updateAutoScroll = (clientY: number): void => {
    const listElement = listRef.current
    if (!listElement) {
      setAutoScrollDirection(0)
      return
    }

    const rect = listElement.getBoundingClientRect()
    if (clientY < rect.top + AUTO_SCROLL_EDGE_PX) {
      setAutoScrollDirection(-1)
    } else if (clientY > rect.bottom - AUTO_SCROLL_EDGE_PX) {
      setAutoScrollDirection(1)
    } else {
      setAutoScrollDirection(0)
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLElement>): void => {
    const dragState = dragStateRef.current
    const listElement = listRef.current
    if (!dragState || !listElement) {
      return
    }

    const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY)
    if (!dragState.dragging && distance > DRAG_THRESHOLD_PX) {
      if (dragState.itemIds.length === 0) {
        dragState.cancelClick = true
        return
      }

      dragState.dragging = true
      setOpenMenuId(null)
      setDraggingItemIds(dragState.itemIds)
      setDragItems(items)
    }

    if (!dragState.dragging) {
      return
    }

    updateAutoScroll(event.clientY)
    const targetIndex = getTargetIndex(event.clientY, displayItems, listElement)
    if (targetIndex == null || targetIndex === dragState.targetIndex) {
      return
    }

    const targetItem = displayItems[targetIndex]
    if (targetItem && dragState.itemIds.includes(targetItem.id)) {
      return
    }

    const movedItems = movePendingItems(displayItems, dragState.itemIds, targetIndex)
    if (movedItems) {
      dragState.targetIndex = targetIndex
      setDragItems(movedItems)
    }
  }

  const endPointerGesture = (event: PointerEvent<HTMLElement>, item: QueueItem): void => {
    const dragState = dragStateRef.current
    if (!dragState) {
      return
    }

    if (event.currentTarget.hasPointerCapture(dragState.pointerId)) {
      event.currentTarget.releasePointerCapture(dragState.pointerId)
    }

    if (dragState.dragging) {
      const targetIndex = dragState.targetIndex
      const originalIndex = dragState.originalIndex
      const itemIds = dragState.itemIds
      setDragItems(null)
      setDraggingItemIds([])
      setAutoScrollDirection(0)
      dragStateRef.current = null

      if (targetIndex !== originalIndex && itemIds.length > 0) {
        void moveMany(itemIds, targetIndex)
      }
      return
    }

    dragStateRef.current = null
    if (!dragState.cancelClick) {
      toggleSelected(item)
    }
  }

  const cancelPointerGesture = (): void => {
    dragStateRef.current = null
    setDragItems(null)
    setDraggingItemIds([])
    setAutoScrollDirection(0)
  }

  return (
    <section className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] text-white">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-white/10 bg-black/70 p-4 backdrop-blur">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold">Queue</h2>
          <p className="truncate text-sm text-white/50">
            {items.length === 0 ? 'No queued downloads' : `${items.length} queued item(s)`}
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

      <div
        ref={listRef}
        className="min-h-0 overflow-y-auto overflow-x-hidden border-b border-white/10"
        onPointerDown={clearSelectionFromBlankSpace}
      >
        <div
          className="grid min-h-full w-full content-start divide-y divide-white/10"
          role="list"
          onPointerDown={clearSelectionFromBlankSpace}
        >
          {displayItems.map((item, index) => {
            const isSelected = visibleSelectedIds.includes(item.id)
            const isDragging = draggingItemIds.includes(item.id)
            const selectable = item.status !== 'active'
            const draggable = item.status === 'pending'

            return (
              <article
                key={item.id}
                data-queue-item-id={item.id}
                role="listitem"
                tabIndex={selectable ? 0 : -1}
                aria-selected={isSelected}
                className={cn(
                  'relative grid min-w-0 select-none grid-cols-[2rem_minmax(0,1fr)] items-center outline-none transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-white/70',
                  selectable && 'cursor-pointer',
                  draggable && 'cursor-grab active:cursor-grabbing',
                  isSelected && 'bg-white/10 hover:bg-white/10',
                  isDragging && 'bg-white/15 shadow-lg shadow-black/30'
                )}
                onPointerDown={(event) => beginPointerGesture(event, item, index)}
                onPointerMove={handlePointerMove}
                onPointerUp={(event) => endPointerGesture(event, item)}
                onPointerCancel={cancelPointerGesture}
                onKeyDown={(event) => {
                  if ((event.key === 'Enter' || event.key === ' ') && selectable) {
                    event.preventDefault()
                    toggleSelected(item)
                  }
                }}
              >
                {isSelected ? (
                  <span className="absolute left-0 top-0 h-full w-1 bg-primary" aria-hidden />
                ) : null}

                <button
                  type="button"
                  className={cn(
                    'no-drag relative z-10 flex h-full min-h-20 cursor-pointer items-center justify-center text-white/40 outline-none transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70',
                    openMenuId === item.id && 'bg-white/10 text-white'
                  )}
                  aria-label={`Queue actions for ${item.metadata.title}`}
                  aria-haspopup="menu"
                  aria-expanded={openMenuId === item.id}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    setOpenMenuId((current) => (current === item.id ? null : item.id))
                  }}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <Icon name="move" size={20} />
                </button>

                <div className="flex min-w-0 gap-2 p-2 pl-0">
                  <div className="relative aspect-video h-16 shrink-0 overflow-hidden rounded-md bg-white/10">
                    {item.metadata.thumbnail ? (
                      <img
                        src={item.metadata.thumbnail}
                        alt=""
                        className="size-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1 self-center">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 text-xs font-bold text-primary">#{index + 1}</span>
                      <span className="truncate text-xs uppercase text-white/40">
                        {statusLabel(item)}
                      </span>
                    </div>
                    <h3 className="truncate font-bold">{item.metadata.title}</h3>
                    <p className="truncate text-sm text-white/50">
                      {item.error ?? formatTransferDetail(item.progress)}
                    </p>
                  </div>
                </div>

                {openMenuId === item.id ? (
                  <QueueItemActionMenu
                    item={item}
                    onClose={() => setOpenMenuId(null)}
                    onCancel={() => void cancelActive()}
                    onRetry={() => void retry(item.id)}
                    onRemove={() => void removeItem(item.id)}
                  />
                ) : null}
              </article>
            )
          })}
        </div>
      </div>
      <div className="flex divide-x divide-white/10 shrink-0 border-t border-white/10">
        {selectedCount > 0 ? (
          <Button
            icon="trash"
            label={`Delete (${selectedCount})`}
            size="lg"
            className="w-full rounded-none"
            onClick={() => void deleteSelected()}
          />
        ) : (
          <Button
            icon="trash"
            label="Clear"
            size="lg"
            className="w-full rounded-none"
            onClick={() => void clear()}
          />
        )}
      </div>
    </section>
  )
}
