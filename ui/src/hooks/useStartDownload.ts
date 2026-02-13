import { useCallback } from "react";
import { useDownloadStore } from "../stores/downloadStore";

export function useStartDownload() {
    const startDownload = useCallback(() => {
        const { url, format, resolution, bitrate, fps } = useDownloadStore.getState();

        if (!url || url.trim() === "") return;

        const message = `download:${url}|${format}|${resolution}|${bitrate}|${fps}`;

        if (window.chrome?.webview) {
            window.chrome.webview.postMessage(message);
        }
    }, []);

    return startDownload;
}