import { describe, expect, it } from 'vitest';
import { getHistoryQueueAction } from '@renderer/lib/historyEntryActions';

describe('getHistoryQueueAction', () => {
  it('returns download for fetched entries', () => {
    expect(getHistoryQueueAction('fetched')).toBe('download');
  });

  it('returns no queue action for failed fetch entries', () => {
    expect(getHistoryQueueAction('fetch_failed')).toBeNull();
  });

  it('keeps requeue for existing download lifecycle states', () => {
    expect(getHistoryQueueAction('started')).toBe('requeue');
    expect(getHistoryQueueAction('completed')).toBe('requeue');
    expect(getHistoryQueueAction('failed')).toBe('requeue');
    expect(getHistoryQueueAction('cancelled')).toBe('requeue');
  });
});
