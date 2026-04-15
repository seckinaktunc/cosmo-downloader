import type { QueueItemStatus } from './types'

type QueueItemLike = {
  id: string
  status: QueueItemStatus
}

export function movePendingItem<T extends QueueItemLike>(
  items: T[],
  itemId: string,
  targetIndex: number
): T[] | null {
  return movePendingItems(items, [itemId], targetIndex)
}

export function movePendingItems<T extends QueueItemLike>(
  items: T[],
  itemIds: string[],
  targetIndex: number
): T[] | null {
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= items.length) {
    return null
  }

  const movingIds = Array.from(new Set(itemIds))
  if (movingIds.length === 0) {
    return null
  }

  const targetItem = items[targetIndex]
  if (!targetItem || targetItem.status !== 'pending') {
    return null
  }

  const pendingSlots = items
    .map((item, index) => (item.status === 'pending' ? index : -1))
    .filter((index) => index >= 0)
  const targetPendingIndex = pendingSlots.indexOf(targetIndex)
  const pendingItems = pendingSlots.map((index) => items[index])
  const movingIdSet = new Set(movingIds)
  const movingItems = pendingItems.filter((item) => movingIdSet.has(item.id))

  if (targetPendingIndex < 0 || movingItems.length !== movingIds.length) {
    return null
  }

  if (movingIds.includes(targetItem.id)) {
    return [...items]
  }

  const remainingItems = pendingItems.filter((item) => !movingIdSet.has(item.id))
  remainingItems.splice(targetPendingIndex, 0, ...movingItems)

  const nextItems = [...items]
  pendingSlots.forEach((slot, index) => {
    nextItems[slot] = remainingItems[index]
  })

  return nextItems
}

export function removeManyQueueItems<T extends QueueItemLike>(items: T[], itemIds: string[]): T[] {
  const selectedIds = new Set(itemIds)
  return items.filter((item) => item.status === 'active' || !selectedIds.has(item.id))
}
