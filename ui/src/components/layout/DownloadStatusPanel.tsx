import { useDownloadState } from "../../hooks/useDownloadState";
import { useLocale } from "../../locale";
import { useDownloadStore } from "../../stores/downloadStore";
import { postWebViewMessage } from "../../lib/webview";
import { isActiveDownloadStatus } from "../../types/download";
import Box from "../ui/Box";
import Button from "../Button";

export default function DownloadStatusPanel() {
  const state = useDownloadState();
  const { locale } = useLocale();
  const reset = useDownloadStore((state) => state.reset);
  if (state.status === "idle") return null;

  const isActiveDownload = isActiveDownloadStatus(state.status);
  const progressWidth = isActiveDownload ? `${state.progress}%` : "100%";
  const playlistSuffix = state.playlistProgress == null
    ? ""
    : ` (${state.playlistProgress.current}/${state.playlistProgress.total})`;

  let title = locale.downloadStatus.doneTitle;
  let description = locale.downloadStatus.doneDescription;
  if (state.status === "downloading") {
    title = `${locale.downloadStatus.downloadingTitle}${playlistSuffix}`;
    description = locale.downloadStatus.downloadingDescription;
  } else if (state.status === "merging") {
    title = `${locale.downloadStatus.mergingTitle}${playlistSuffix}`;
    description = locale.downloadStatus.mergingDescription;
  } else if (state.status === "converting") {
    title = `${locale.downloadStatus.convertingTitle}${playlistSuffix}`;
    description = locale.downloadStatus.convertingDescription;
  } else if (state.status === "error") {
    title = locale.downloadStatus.errorTitle;
    description = locale.downloadStatus.errorDescription;
  }

  return (
    <Box className="flex-col p-4 items-start gap-0">
      <div className="grid grid-cols-[1fr_auto] w-full">
        <span className="text-sm font-bold text-white uppercase tracking-widest">{title}</span>
        {!isActiveDownload &&
          <Button
            variant="secondary"
            isIcon
            size="xs"
            icon="close"
            iconSize={16}
            ghost
            onClick={reset}
          />
        }
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2 w-full">
        <span className="text-xs text-white/30">{description}</span>
        {isActiveDownload
          ? <span className="text-xs text-white font-bold">%{state.progress}</span>
          : <Button
            variant="tertiary"
            icon="fileInfo"
            iconSize={16}
            label="View logs"
            onClick={() => postWebViewMessage("open_download_logs")}
          />
        }
      </div>

      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden mt-3">
        <div
          className={`h-full transition-all duration-700 ease-out ${isActiveDownload ? "bg-primary animate-pulse" : "bg-primary"}`}
          style={{ width: progressWidth }}
        />
      </div>
    </Box>
  );
}
