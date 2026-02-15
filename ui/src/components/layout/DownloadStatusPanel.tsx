import { useDownloadState } from "../../hooks/useDownloadState";
import { useLocale } from "../../locale";
import { useDownloadStore } from "../../stores/downloadStore";
import Box from "../ui/Box";
import Button from "../Button";

export default function DownloadStatusPanel() {
  const state = useDownloadState();
  const { locale } = useLocale();
  const reset = useDownloadStore((state) => state.reset);
  if (state.status === "idle") return null;

  const isDownloading = state.status === "downloading";
  const progressWidth = isDownloading ? `${state.progress}%` : "100%";

  let title = locale.downloadStatus.doneTitle;
  let description = locale.downloadStatus.doneDescription;
  if (isDownloading) {
    title = locale.downloadStatus.downloadingTitle;
    description = locale.downloadStatus.downloadingDescription;
  } else if (state.status === "error") {
    title = locale.downloadStatus.errorTitle;
    description = locale.downloadStatus.errorDescription;
  }

  return (
    <Box className="flex-col p-4 items-start gap-4">
      <div className="flex w-full justify-between items-end px-1">
        {!isDownloading &&
          <Button
            isIcon
            size="md"
            icon="close"
            iconSize={16}
            className="absolute top-0 right-0"
            ghost
            onClick={reset}
          />
        }
        <div className="flex flex-col">
          <span className="text-sm font-bold text-white uppercase tracking-widest">{title}</span>
          <span className="text-xs text-white/30">{description}</span>
        </div>
        {isDownloading && <span className="text-xs text-white font-bold">%{state.progress}</span>}
      </div>

      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-700 ease-out ${isDownloading ? "bg-primary animate-pulse" : "bg-primary"}`}
          style={{ width: progressWidth }}
        />
      </div>
    </Box>
  );
}
