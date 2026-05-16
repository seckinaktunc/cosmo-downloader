import type { DownloadHistoryStatus } from './types';

export type HistoryQueueAction = 'download' | 'requeue' | null;

export function isHistoryEntryEditable(status: DownloadHistoryStatus): boolean {
  return status === 'fetched' || status === 'failed' || status === 'cancelled';
}

export function canStartHistoryDirectDownload(status: DownloadHistoryStatus): boolean {
  return isHistoryEntryEditable(status);
}

export function getHistoryQueueAction(status: DownloadHistoryStatus): HistoryQueueAction {
  if (status === 'fetched') {
    return 'download';
  }

  if (status === 'fetch_failed') {
    return null;
  }

  return 'requeue';
}
