export type ActiveDownloadStatus = "downloading" | "merging" | "converting";
export type DownloadStatus = "idle" | ActiveDownloadStatus | "done" | "error";

export interface PlaylistProgress {
  current: number;
  total: number;
}

export interface DownloadState {
  status: DownloadStatus;
  progress: number;
  playlistProgress: PlaylistProgress | null;
}

const ACTIVE_DOWNLOAD_STATUS_SET: ReadonlySet<DownloadStatus> = new Set<DownloadStatus>([
  "downloading",
  "merging",
  "converting",
]);

export function isActiveDownloadStatus(status: DownloadStatus): status is ActiveDownloadStatus {
  return ACTIVE_DOWNLOAD_STATUS_SET.has(status);
}
