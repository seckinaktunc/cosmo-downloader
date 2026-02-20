import { useCallback } from "react";
import { postWebViewMessage } from "@/lib/webview";
import { useDownloadStore } from "@/stores/downloadStore";
import { useSettingsStore } from "@/stores/settingsStore";

export function useDownloadThumbnail() {
  const downloadThumbnail = useCallback(() => {
    const { url } = useDownloadStore.getState();
    const {
      alwaysAskDownloadDirectory,
      defaultDownloadDirectory,
      browserForCookies,
    } = useSettingsStore.getState();

    const normalizedUrl = url.trim();
    if (normalizedUrl.length === 0) {
      return false;
    }

    return postWebViewMessage(
      `download_thumbnail:${normalizedUrl}|${alwaysAskDownloadDirectory}|${defaultDownloadDirectory}|${browserForCookies}`,
    );
  }, []);

  return downloadThumbnail;
}
