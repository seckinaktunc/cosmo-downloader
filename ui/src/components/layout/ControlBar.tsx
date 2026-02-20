import { type KeyboardEvent, useMemo } from "react";
import { useAutoMetadataFetch } from "@/hooks/useAutoMetadataFetch";
import { useCancelDownload } from "@/hooks/useCancelDownload";
import { useFetchMetadata } from "@/hooks/useFetchMetadata";
import { useStartDownload } from "@/hooks/useStartDownload";
import { useLocale } from "@/locale";
import { useClipboardStore } from "@/stores/clipboardStore";
import { useDownloadStore } from "@/stores/downloadStore";
import { useGlobalStore } from "@/stores/globalStore";
import { useMetadataStore } from "@/stores/metadataStore";
import { isActiveDownloadStatus } from "@/types/download";
import { isCompleteSupportedVideoUrl } from "@/utils/videoUrlClassifier";
import { validateUrl } from "@/utils/validateUrl";
import Button from "../Button";
import InputBox from "../InputBox";
import Box from "../ui/Box";

export default function ControlBar() {
  const startDownload = useStartDownload();
  const cancelDownload = useCancelDownload();
  const fetchMetadata = useFetchMetadata();
  const { locale } = useLocale();

  useAutoMetadataFetch();

  const status = useDownloadStore((state) => state.status);
  const url = useDownloadStore((state) => state.url);
  const setUrl = useDownloadStore((state) => state.setUrl);
  const resetDownload = useDownloadStore((state) => state.reset);

  const clipboardText = useClipboardStore((state) => state.text);

  const isPreferencesOpen = useGlobalStore((state) => state.isPreferencesOpen);
  const togglePreferences = useGlobalStore((state) => state.togglePreferences);

  const isSettingsOpen = useGlobalStore((state) => state.isSettingsOpen);
  const toggleSettings = useGlobalStore((state) => state.toggleSettings);

  const metadataStatus = useMetadataStore((state) => state.status);
  const metadataSourceUrl = useMetadataStore((state) => state.sourceUrl);
  const resetMetadata = useMetadataStore((state) => state.reset);

  const normalizedUrl = url.trim();
  const isActiveDownload = isActiveDownloadStatus(status);
  const isMetadataFetchingForCurrentUrl =
    metadataStatus === "fetching" &&
    metadataSourceUrl === normalizedUrl;
  const hasMetadataForCurrentUrl =
    metadataStatus === "ready" &&
    metadataSourceUrl === normalizedUrl;

  const shouldFetchBeforeDownload =
    isCompleteSupportedVideoUrl(normalizedUrl) &&
    !hasMetadataForCurrentUrl;

  const validation = useMemo(() => {
    return validateUrl(url, {
      allowedProtocols: ["https:"],
      allowedHosts: ["youtube.com", "youtu.be", "tiktok.com", "instagram.com"],
      allowLocalhost: false,
      allowHash: false,
    });
  }, [url]);

  const isBusy = isActiveDownload || isMetadataFetchingForCurrentUrl;
  const canDownload =
    normalizedUrl.length > 0 &&
    validation.isValid &&
    !isMetadataFetchingForCurrentUrl;
  const isPrimaryDisabled = isActiveDownload ? false : !canDownload;
  const canPasteFromClipboard = !isBusy && clipboardText.trim().length > 0;

  const handlePrimaryAction = () => {
    if (isActiveDownload) {
      cancelDownload();
      return;
    }

    if (!canDownload) {
      return;
    }

    if (shouldFetchBeforeDownload) {
      fetchMetadata();
      return;
    }

    startDownload();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && !isPrimaryDisabled) {
      handlePrimaryAction();
    }
  };

  const handlePasteFromClipboard = () => {
    if (!canPasteFromClipboard) {
      return;
    }

    setUrl(clipboardText.trim());
    resetMetadata();
  };

  return (
    <Box>
      <InputBox
        type="text"
        value={url}
        onChange={(event) => {
          setUrl(event.target.value);
          resetMetadata();
        }}
        disabled={isBusy}
        placeholder={locale.controlBar.urlPlaceholder}
        containerClassName="flex-1"
        onClear={() => {
          resetDownload();
          resetMetadata();
        }}
        onPaste={canPasteFromClipboard ? handlePasteFromClipboard : undefined}
        onKeyDown={handleKeyDown}
      />

      <Button
        variant="primary"
        onClick={handlePrimaryAction}
        disabled={isPrimaryDisabled}
        icon={isActiveDownload ? "close" : "download"}
        label={
          isActiveDownload
            ? locale.controlBar.cancel
            : isMetadataFetchingForCurrentUrl
              ? locale.controlBar.downloading
              : locale.controlBar.download
        }
        loading={isMetadataFetchingForCurrentUrl}
      />

      <Button
        variant="secondary"
        isIcon
        ghost={isPreferencesOpen ? false : true}
        icon="preferences"
        onClick={togglePreferences}
      />
      <Button
        variant="secondary"
        isIcon
        ghost={isSettingsOpen ? false : true}
        icon={isSettingsOpen ? "settingsFilled" : "settings"}
        className="[&_svg]:transition-transform hover:[&_svg]:rotate-90"
        onClick={toggleSettings}
      />
    </Box>
  );
}
