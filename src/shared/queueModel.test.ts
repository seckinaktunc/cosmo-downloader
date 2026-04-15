import { describe, expect, it } from 'vitest'
import type { QueueItemStatus } from './types'
import { movePendingItem, movePendingItems, removeManyQueueItems } from './queueModel'

type TestQueueItem = {
  id: string
  status: QueueItemStatus
}

function item(id: string, status: QueueItemStatus): TestQueueItem {
  return { id, status }
}

describe('queueModel', () => {
  it('moves pending items within pending slots without moving active or terminal items', () => {
    const items = [
      item('active', 'active'),
      item('one', 'pending'),
      item('done', 'completed'),
      item('two', 'pending'),
      item('three', 'pending')
    ]

    expect(movePendingItem(items, 'three', 1)?.map((entry) => entry.id)).toEqual([
      'active',
      'three',
      'done',
      'one',
      'two'
    ])
  })

  it('rejects moving non-pending items', () => {
    expect(
      movePendingItem([item('active', 'active'), item('one', 'pending')], 'active', 1)
    ).toBeNull()
  })

  it('rejects target indexes outside pending slots', () => {
    expect(
      movePendingItem(
        [item('one', 'pending'), item('done', 'completed'), item('two', 'pending')],
        'one',
        1
      )
    ).toBeNull()
  })

  it('moves selected pending items as a group while preserving fixed non-pending slots', () => {
    const items = [
      item('active', 'active'),
      item('one', 'pending'),
      item('done', 'completed'),
      item('two', 'pending'),
      item('three', 'pending'),
      item('four', 'pending')
    ]

    expect(movePendingItems(items, ['two', 'three'], 5)?.map((entry) => entry.id)).toEqual([
      'active',
      'one',
      'done',
      'four',
      'two',
      'three'
    ])
  })

  it('rejects grouped moves that include non-pending items', () => {
    expect(
      movePendingItems(
        [item('one', 'pending'), item('done', 'completed'), item('two', 'pending')],
        ['one', 'done'],
        2
      )
    ).toBeNull()
  })

  it('rejects grouped moves with no pending item ids', () => {
    expect(movePendingItems([item('one', 'pending'), item('two', 'pending')], [], 1)).toBeNull()
  })

  it('removes many selected items while preserving active items', () => {
    const items = [
      item('active', 'active'),
      item('one', 'pending'),
      item('done', 'completed'),
      item('failed', 'failed')
    ]

    expect(
      removeManyQueueItems(items, ['active', 'one', 'failed']).map((entry) => entry.id)
    ).toEqual(['active', 'done'])
  })
})
