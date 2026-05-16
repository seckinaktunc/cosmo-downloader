import { describe, expect, it } from 'vitest';
import {
  canStartHistoryDirectDownload,
  getHistoryQueueAction,
  isHistoryEntryEditable
} from '@renderer/lib/historyEntryActions';

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

  it('marks fetched, failed, and cancelled history entries as editable and direct-startable', () => {
    expect(isHistoryEntryEditable('fetched')).toBe(true);
    expect(isHistoryEntryEditable('failed')).toBe(true);
    expect(isHistoryEntryEditable('cancelled')).toBe(true);
    expect(canStartHistoryDirectDownload('fetched')).toBe(true);
    expect(canStartHistoryDirectDownload('failed')).toBe(true);
    expect(canStartHistoryDirectDownload('cancelled')).toBe(true);
  });

  it('keeps fetch_failed, started, and completed history entries read-only', () => {
    expect(isHistoryEntryEditable('fetch_failed')).toBe(false);
    expect(isHistoryEntryEditable('started')).toBe(false);
    expect(isHistoryEntryEditable('completed')).toBe(false);
    expect(canStartHistoryDirectDownload('fetch_failed')).toBe(false);
    expect(canStartHistoryDirectDownload('started')).toBe(false);
    expect(canStartHistoryDirectDownload('completed')).toBe(false);
  });
});
