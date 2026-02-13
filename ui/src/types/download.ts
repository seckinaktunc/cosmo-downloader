export type DownloadStatus = "idle" | "downloading" | "done" | "error";

export interface DownloadState {
  status: DownloadStatus;
  progress: number;
}
