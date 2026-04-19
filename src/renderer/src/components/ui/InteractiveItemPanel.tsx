import { formatPercent } from '@renderer/lib/formatters'
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { DownloadHistoryStatus, QueueItem, QueueItemStatus } from '../../../../shared/types'
import { cn } from '../../lib/utils'
import Icon from '../miscellaneous/Icon'
import { ActionMenu, type ActionMenuAnchor, type ActionMenuItem } from './ActionMenu'
import { Button } from './Button'
import { Thumbnail, type ThumbnailAction } from './Thumbnail'

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

type MenuState = {
  itemId: string
  anchor: ActionMenuAnchor
}

type ItemStatus = QueueItemStatus | DownloadHistoryStatus

export type InteractiveItemPanelProps<TItem> = {
  title: string
  subtitle: string
  items: TItem[]
  getId: (item: TItem) => string
  getStatus: (item: TItem) => ItemStatus
  getTitle: (item: TItem) => string
  getHint?: (item: TItem, index: number) => string | undefined
  getThumbnail?: (item: TItem) => string | undefined
  getThumbnailBadge?: (item: TItem) => string | undefined
  getThumbnailActions?: (item: TItem) => ThumbnailAction[] | undefined
  getThumbnailActionsEnabled?: (item: TItem) => boolean
  getMetaLabel?: (item: TItem) => string | undefined
  getDetail?: (item: TItem) => string | undefined
  getActions?: (item: TItem) => ActionMenuItem[]
  activeItemId?: string
  onActivateItem?: (item: TItem) => void
  isActivatable?: (item: TItem) => boolean
  isBulkSelectable?: (item: TItem) => boolean
  isDraggable?: (item: TItem) => boolean
  getDragGroupIds?: (item: TItem, context: { items: TItem[]; selectedIds: Set<string> }) => string[]
  previewMoveItems?: (items: TItem[], itemIds: string[], targetIndex: number) => TItem[] | null
  moveItems?: (itemIds: string[], targetIndex: number) => void | Promise<void>
  onDeleteSelected?: (itemIds: string[]) => void | Promise<void>
  onClearSelection?: () => void
  onClear?: () => void | Promise<void>
  onClose?: () => void
  emptyDetail?: string
  clearLabel?: string
  deleteLabel?: (count: number) => string
  closeLabel?: string
  actionsLabel?: (title: string) => string
  menuLabel?: string
}

function getTargetIndex<TItem>(
  clientY: number,
  items: TItem[],
  listElement: HTMLElement,
  isDraggable: (item: TItem) => boolean
): number | null {
  const rows = Array.from(listElement.querySelectorAll<HTMLElement>('[data-interactive-item-id]'))
  if (rows.length === 0) {
    return null
  }

  const rawIndex = rows.findIndex((row) => {
    const rect = row.getBoundingClientRect()
    return clientY < rect.top + rect.height / 2
  })
  const targetIndex = rawIndex < 0 ? rows.length - 1 : rawIndex
  if (items[targetIndex] && isDraggable(items[targetIndex])) {
    return targetIndex
  }

  const draggableIndexes = items
    .map((item, index) => (isDraggable(item) ? index : -1))
    .filter((index) => index >= 0)
  if (draggableIndexes.length === 0) {
    return null
  }

  return draggableIndexes.reduce((closest, index) =>
    Math.abs(index - targetIndex) < Math.abs(closest - targetIndex) ? index : closest
  )
}

function getStatusLabel(
  item: QueueItem,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  if (item.status === 'active') {
    const percent = formatPercent(item.progress?.percentage)
    return percent ? percent : t('queue.status.active')
  }

  return t(`queue.status.${item.status}`)
}

export function InteractiveItemPanel<TItem>({
  title,
  subtitle,
  items,
  getId,
  getTitle,
  getStatus,
  getHint,
  getThumbnail,
  getThumbnailBadge,
  getThumbnailActions,
  getThumbnailActionsEnabled,
  getMetaLabel,
  getActions,
  activeItemId,
  onActivateItem,
  isActivatable = () => true,
  isBulkSelectable = () => true,
  isDraggable = () => false,
  getDragGroupIds,
  previewMoveItems,
  moveItems,
  onDeleteSelected,
  onClearSelection,
  onClear,
  onClose,
  clearLabel = 'Clear',
  deleteLabel = (count) => `Delete (${count})`,
  closeLabel = 'Close',
  actionsLabel = (title) => `Actions for ${title}`,
  menuLabel = `${title} item actions`
}: InteractiveItemPanelProps<TItem>): React.JSX.Element {
  const { t } = useTranslation()
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(() => new Set())
  const [menuState, setMenuState] = useState<MenuState | null>(null)
  const [dragItems, setDragItems] = useState<TItem[] | null>(null)
  const [draggingItemIds, setDraggingItemIds] = useState<string[]>([])
  const [autoScrollDirection, setAutoScrollDirection] = useState<-1 | 0 | 1>(0)
  const listRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<DragState | null>(null)
  const displayItems = dragItems ?? items

  const bulkSelectableIds = useMemo(
    () => new Set(items.filter((item) => isBulkSelectable(item)).map((item) => getId(item))),
    [getId, isBulkSelectable, items]
  )
  const visibleBulkSelectedIds = useMemo(
    () => Array.from(bulkSelectedIds).filter((id) => bulkSelectableIds.has(id)),
    [bulkSelectableIds, bulkSelectedIds]
  )
  const selectedCount = visibleBulkSelectedIds.length
  const menuItem =
    menuState == null ? undefined : displayItems.find((item) => getId(item) === menuState.itemId)
  const menuItems = menuItem && getActions ? getActions(menuItem) : []

  useEffect(() => {
    setBulkSelectedIds((current) => {
      const next = new Set(Array.from(current).filter((id) => bulkSelectableIds.has(id)))
      const changed = next.size !== current.size || Array.from(current).some((id) => !next.has(id))
      return changed ? next : current
    })
  }, [bulkSelectableIds])

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

  const activateItem = (item: TItem): void => {
    if (isActivatable(item)) {
      onActivateItem?.(item)
    }
  }

  const toggleBulkSelected = (item: TItem): void => {
    if (!isBulkSelectable(item)) {
      return
    }

    const itemId = getId(item)
    setBulkSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  const handleRowClick = (event: PointerEvent<HTMLElement>, item: TItem): void => {
    const itemId = getId(item)
    const modifierPressed = event.metaKey || event.ctrlKey

    if (modifierPressed) {
      toggleBulkSelected(item)
      if (activeItemId !== itemId) {
        activateItem(item)
      }
      return
    }

    setBulkSelectedIds(new Set())
    activateItem(item)
  }

  const deleteSelected = async (): Promise<void> => {
    if (!onDeleteSelected) {
      return
    }

    await onDeleteSelected(visibleBulkSelectedIds)
    setBulkSelectedIds(new Set())
  }

  const getDefaultDragItemIds = (item: TItem): string[] => {
    if (!isDraggable(item)) {
      return []
    }

    const itemId = getId(item)
    if (!bulkSelectedIds.has(itemId)) {
      return [itemId]
    }

    return items
      .filter((candidate) => isDraggable(candidate) && bulkSelectedIds.has(getId(candidate)))
      .map((candidate) => getId(candidate))
  }

  const getResolvedDragItemIds = (item: TItem): string[] => {
    return getDragGroupIds
      ? getDragGroupIds(item, { items, selectedIds: bulkSelectedIds })
      : getDefaultDragItemIds(item)
  }

  const clearSelectionFromBlankSpace = (event: PointerEvent<HTMLElement>): void => {
    if (dragStateRef.current || event.target !== event.currentTarget) {
      return
    }

    setBulkSelectedIds(new Set())
    onClearSelection?.()
  }

  const beginPointerGesture = (
    event: PointerEvent<HTMLElement>,
    item: TItem,
    index: number
  ): void => {
    if (event.button !== 0 || (!isActivatable(item) && !isBulkSelectable(item))) {
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    dragStateRef.current = {
      itemId: getId(item),
      itemIds: getResolvedDragItemIds(item),
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
    if (!dragState || !listElement || !previewMoveItems || !moveItems) {
      return
    }

    const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY)
    if (!dragState.dragging && distance > DRAG_THRESHOLD_PX) {
      if (dragState.itemIds.length === 0) {
        dragState.cancelClick = true
        return
      }

      dragState.dragging = true
      setMenuState(null)
      setDraggingItemIds(dragState.itemIds)
      setDragItems(items)
    }

    if (!dragState.dragging) {
      return
    }

    updateAutoScroll(event.clientY)
    const targetIndex = getTargetIndex(event.clientY, displayItems, listElement, isDraggable)
    if (targetIndex == null || targetIndex === dragState.targetIndex) {
      return
    }

    const targetItem = displayItems[targetIndex]
    if (targetItem && dragState.itemIds.includes(getId(targetItem))) {
      return
    }

    const movedItems = previewMoveItems(displayItems, dragState.itemIds, targetIndex)
    if (movedItems) {
      dragState.targetIndex = targetIndex
      setDragItems(movedItems)
    }
  }

  const endPointerGesture = (event: PointerEvent<HTMLElement>, item: TItem): void => {
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

      if (targetIndex !== originalIndex && itemIds.length > 0 && moveItems) {
        void moveItems(itemIds, targetIndex)
      }
      return
    }

    dragStateRef.current = null
    if (!dragState.cancelClick) {
      handleRowClick(event, item)
    }
  }

  const cancelPointerGesture = (): void => {
    dragStateRef.current = null
    setDragItems(null)
    setDraggingItemIds([])
    setAutoScrollDirection(0)
  }

  const openMenu = (item: TItem, anchor: ActionMenuAnchor): void => {
    if (!getActions || getActions(item).length === 0) {
      return
    }

    setMenuState({ itemId: getId(item), anchor })
  }

  return (
    <section className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] text-white">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-white/10 bg-black p-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <h2 className="truncate font-bold">{title}</h2>
          <p className="truncate text-sm text-white/50">{subtitle}</p>
        </div>
        {onClose ? (
          <div className="flex shrink-0">
            <Button
              icon="close"
              label={closeLabel}
              className="absolute top-0 right-0"
              onlyIcon
              ghost
              onClick={onClose}
            />
          </div>
        ) : null}
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
            const itemId = getId(item)
            const itemStatus: ItemStatus = getStatus(item)
            const itemTitle = getTitle(item)
            const itemHint = getHint ? getHint(item, index) : undefined
            const isActiveItem = activeItemId === itemId
            const isBulkSelected = visibleBulkSelectedIds.includes(itemId)
            const isDragging = draggingItemIds.includes(itemId)
            const activatable = isActivatable(item)
            const bulkSelectable = isBulkSelectable(item)
            const draggable = isDraggable(item)
            const thumbnail = getThumbnail?.(item)
            const thumbnailBadge = getThumbnailBadge?.(item)
            const thumbnailActions = getThumbnailActions?.(item)
            const thumbnailActionsEnabled = getThumbnailActionsEnabled?.(item) ?? true
            const statusLabel = getStatusLabel(item as QueueItem, t)
            const metaLabel = getMetaLabel?.(item)

            return (
              <article
                key={itemId}
                data-interactive-item-id={itemId}
                role="listitem"
                tabIndex={activatable || bulkSelectable ? 0 : -1}
                aria-selected={isActiveItem || isBulkSelected}
                className={cn(
                  'relative grid min-w-0 select-none grid-cols-[1.5rem_minmax(0,1fr)] items-center outline-none transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-white/70',
                  (activatable || bulkSelectable) && 'cursor-pointer',
                  draggable && 'cursor-grab active:cursor-grabbing',
                  (isActiveItem || isBulkSelected) && 'bg-white/10 hover:bg-white/10',
                  isDragging && 'bg-white/15 shadow-lg shadow-black/30'
                )}
                onPointerDown={(event) => beginPointerGesture(event, item, index)}
                onPointerMove={handlePointerMove}
                onPointerUp={(event) => endPointerGesture(event, item)}
                onPointerCancel={cancelPointerGesture}
                onContextMenu={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  openMenu(item, { type: 'point', x: event.clientX, y: event.clientY })
                }}
                onKeyDown={(event) => {
                  if (
                    (event.key === 'Enter' || event.key === ' ') &&
                    (activatable || bulkSelectable)
                  ) {
                    event.preventDefault()
                    if (event.metaKey || event.ctrlKey) {
                      toggleBulkSelected(item)
                      if (!isActiveItem) {
                        activateItem(item)
                      }
                    } else {
                      setBulkSelectedIds(new Set())
                      activateItem(item)
                    }
                  }
                }}
              >
                {isActiveItem || isBulkSelected ? (
                  <span
                    className={cn(
                      'absolute left-0 top-0 h-full w-1',
                      isActiveItem ? 'bg-primary' : 'bg-white/40'
                    )}
                    aria-hidden
                  />
                ) : null}

                <button
                  type="button"
                  className={cn(
                    'no-drag relative z-10 flex h-full min-h-20 cursor-pointer items-center justify-center text-white/40 outline-none transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70',
                    menuState?.itemId === itemId && 'bg-white/10 text-white'
                  )}
                  aria-label={actionsLabel(itemTitle)}
                  aria-haspopup="menu"
                  aria-expanded={menuState?.itemId === itemId}
                  onPointerDown={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    const currentTarget = event.currentTarget
                    setMenuState((current) =>
                      current?.itemId === itemId
                        ? null
                        : {
                            itemId,
                            anchor: { type: 'element', element: currentTarget }
                          }
                    )
                  }}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <Icon name="move" size={20} />
                </button>

                <div className="flex min-w-0 gap-2 p-2 pl-0">
                  {itemHint && (
                    <span className="absolute right-2 z-10 text-xs font-bold text-white/50">
                      {itemHint}
                    </span>
                  )}
                  <Thumbnail
                    src={thumbnail}
                    title={itemTitle}
                    badge={thumbnailBadge}
                    className="aspect-video h-16 shrink-0 rounded-md bg-white/10"
                    actionSize="xs"
                    showPlaceholderIcon={false}
                    actions={thumbnailActions}
                    actionsEnabled={thumbnailActionsEnabled}
                  />
                  <div className="flex flex-col gap-1 min-w-0 flex-1 self-center">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <div
                        className={cn(
                          'w-3 h-3 rounded-full bg-primary shrink-0',
                          (itemStatus === 'pending' || itemStatus === 'paused') && 'bg-yellow',
                          itemStatus === 'active' && 'bg-green animate-pulse',
                          itemStatus === 'completed' && 'bg-blue'
                        )}
                      />
                      {statusLabel ? (
                        <span className="truncate text-xs uppercase text-white/40">
                          {statusLabel}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="truncate font-bold">{itemTitle}</h3>
                    <p className="truncate text-xs text-white/50">{metaLabel}</p>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>

      {onDeleteSelected || onClear ? (
        <div className="flex shrink-0 divide-x divide-white/10">
          {selectedCount > 0 && onDeleteSelected ? (
            <Button
              icon="trash"
              label={deleteLabel(selectedCount)}
              size="lg"
              className="w-full rounded-none border-none"
              onClick={() => void deleteSelected()}
            />
          ) : onClear ? (
            <Button
              icon="trash"
              label={clearLabel}
              size="lg"
              className="w-full rounded-none border-none"
              onClick={() => void onClear()}
            />
          ) : null}
        </div>
      ) : null}

      <ActionMenu
        open={menuState != null}
        anchor={menuState?.anchor ?? null}
        items={menuItems}
        placement={menuState?.anchor.type === 'point' ? 'bottom-start' : 'right-start'}
        ariaLabel={menuLabel}
        onClose={() => setMenuState(null)}
      />
    </section>
  )
}
