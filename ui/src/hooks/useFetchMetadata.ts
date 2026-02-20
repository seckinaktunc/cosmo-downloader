import { useCallback } from "react";
import { postWebViewMessage } from "@/lib/webview";
import { useDownloadStore } from "@/stores/downloadStore";
import { useMetadataStore } from "@/stores/metadataStore";
import { useSettingsStore } from "@/stores/settingsStore";

export function useFetchMetadata() {
  const fetchMetadata = useCallback(() => {
    const { url } = useDownloadStore.getState();
    const { browserForCookies } = useSettingsStore.getState();
    const { startFetch, markFetchError } = useMetadataStore.getState();

    const normalizedUrl = url.trim();
    if (normalizedUrl.length === 0) {
      return false;
    }

    startFetch(normalizedUrl);
    const sent = postWebViewMessage(`fetch_metadata:${normalizedUrl}|${browserForCookies}`);
    if (!sent) {
      markFetchError(normalizedUrl);
    }

    return sent;
  }, []);

  return fetchMetadata;
}
