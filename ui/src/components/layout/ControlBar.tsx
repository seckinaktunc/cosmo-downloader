import { useMemo } from "react";
import { useStartDownload } from "../../hooks/useStartDownload";
import { useClipboardStore } from "../../stores/clipboardStore";
import { useDownloadStore } from "../../stores/downloadStore";
import { useGlobalStore } from "../../stores/globalStore";
import { validateUrl } from "../../utils/validateUrl";
import { useLocale } from "../../locale";
import Box from "../ui/Box";
import Button from "../Button";
import InputBox from "../InputBox";

export default function ControlBar() {
  const startDownload = useStartDownload();
  const { locale } = useLocale();

  const status = useDownloadStore((state) => state.status);
  const url = useDownloadStore((state) => state.url);
  const clipboardText = useClipboardStore((state) => state.text);

  const setUrl = useDownloadStore((state) => state.setUrl);
  const reset = useDownloadStore((state) => state.reset);

  const isPreferencesOpen = useGlobalStore((state) => state.isPreferencesOpen);
  const togglePreferences = useGlobalStore((state) => state.togglePreferences);

  const isSettingsOpen = useGlobalStore((state) => state.isSettingsOpen);
  const toggleSettings = useGlobalStore((state) => state.toggleSettings);

  const isDownloading = status === "downloading";

  const validation = useMemo(() => {
    return validateUrl(url, {
      allowedProtocols: ["https:"],
      allowedHosts: ["youtube.com", "youtu.be", "tiktok.com", "instagram.com"],
      allowLocalhost: false,
      allowHash: false,
    });
  }, [url]);

  const isDisabled =
    isDownloading || !url || !validation.isValid;
  const canPasteFromClipboard = !isDownloading && clipboardText.trim().length > 0;

  const handleDownload = () => {
    if (isDisabled) return;
    startDownload();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isDisabled) {
      handleDownload();
    }
  };

  const handlePasteFromClipboard = () => {
    if (!canPasteFromClipboard) {
      return;
    }

    setUrl(clipboardText.trim());
  };

  return (
    <Box>
      <InputBox
        type="text"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        disabled={isDownloading}
        placeholder={locale.controlBar.urlPlaceholder}
        containerClassName="flex-1"
        onClear={() => reset()}
        onPaste={canPasteFromClipboard ? handlePasteFromClipboard : undefined}
        onKeyDown={handleKeyDown}
      />

      <Button
        variant="primary"
        onClick={handleDownload}
        disabled={isDownloading || isDisabled}
        icon="download"
        label={isDownloading ? locale.controlBar.downloading : locale.controlBar.download}
        loading={isDownloading}
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
