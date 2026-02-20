import { useCallback } from "react";
import { postWebViewMessage } from "../lib/webview";
import { useDownloadStore } from "../stores/downloadStore";
import { useSettingsStore } from "../stores/settingsStore";

export function useStartDownload() {
    const startDownload = useCallback(() => {
        const { url, format, resolution, bitrate, fps, videoCodec, audioCodec } = useDownloadStore.getState();
        const {
            alwaysAskDownloadDirectory,
            defaultDownloadDirectory,
            browserForCookies,
            hardwareAccelerationMode,
        } = useSettingsStore.getState();

        if (!url || url.trim() === "") return;

        const message =
            `download:${url}|${format}|${resolution}|${bitrate}|${fps}|${videoCodec}|${audioCodec}|` +
            `${alwaysAskDownloadDirectory}|${defaultDownloadDirectory}|${browserForCookies}|${hardwareAccelerationMode}`;
        postWebViewMessage(message);
    }, []);

    return startDownload;
}
