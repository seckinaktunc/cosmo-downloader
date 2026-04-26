import type { DownloadHistoryStatus } from '../../../shared/types';

export type HistoryQueueAction = 'download' | 'requeue' | null;

export function getHistoryQueueAction(status: DownloadHistoryStatus): HistoryQueueAction {
  if (status === 'fetched') {
    return 'download';
  }

  if (status === 'fetch_failed') {
    return null;
  }

  return 'requeue';
}
