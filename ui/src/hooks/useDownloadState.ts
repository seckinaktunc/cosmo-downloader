import { useEffect } from "react";
import { getLocaleMessages } from "../locale";
import { subscribeWebViewMessages } from "../lib/webview";
import { useDownloadStore } from "../stores/downloadStore";
import { useMetadataStore } from "@/stores/metadataStore";
import { useSettingsStore } from "../stores/settingsStore";
import type { DownloadState } from "../types/download";
import { sendNativeNotification } from "../utils/notification";
import {
  parseDownloadStatusMessage,
  parseMetadataMessage,
  parsePlaylistMessage,
  parseProgressMessage,
} from "./downloadEventParsers";

export function useDownloadState(): DownloadState {
  const status = useDownloadStore((state) => state.status);
  const progress = useDownloadStore((state) => state.progress);
  const playlistProgress = useDownloadStore((state) => state.playlistProgress);
  return { status, progress, playlistProgress };
}

export function useDownloadEvents(): void {
  const setProgress = useDownloadStore((state) => state.setProgress);
  const setPlaylistProgress = useDownloadStore((state) => state.setPlaylistProgress);
  const markDownloading = useDownloadStore((state) => state.markDownloading);
  const markMerging = useDownloadStore((state) => state.markMerging);
  const markConverting = useDownloadStore((state) => state.markConverting);
  const markIdle = useDownloadStore((state) => state.markIdle);
  const markDone = useDownloadStore((state) => state.markDone);
  const markError = useDownloadStore((state) => state.markError);
  const setResolution = useDownloadStore((state) => state.setResolution);
  const setFPS = useDownloadStore((state) => state.setFPS);
  const setBitrate = useDownloadStore((state) => state.setBitrate);
  const applyMetadata = useMetadataStore((state) => state.applyMetadata);
  const markFetchError = useMetadataStore((state) => state.markFetchError);

  useEffect(() => {
    const unsubscribe = subscribeWebViewMessages((event) => {
      const message = event.data;

      const metadata = parseMetadataMessage(message);
      if (metadata != null) {
        const activeUrl = useDownloadStore.getState().url.trim();
        if (activeUrl.length === 0 || metadata.url !== activeUrl) {
          return;
        }

        if (metadata.type === "error") {
          markFetchError(metadata.url);
          return;
        }

        applyMetadata(metadata);

        const currentState = useDownloadStore.getState();

        if (
          metadata.availableResolutions.length > 0 &&
          !metadata.availableResolutions.includes(currentState.resolution)
        ) {
          setResolution(metadata.availableResolutions[metadata.availableResolutions.length - 1]);
        }

        if (
          metadata.availableFps.length > 0 &&
          !metadata.availableFps.includes(currentState.fps)
        ) {
          setFPS(metadata.availableFps[metadata.availableFps.length - 1]);
        }

        if (
          metadata.availableBitrates.length > 0 &&
          !metadata.availableBitrates.includes(currentState.bitrate)
        ) {
          setBitrate(metadata.availableBitrates[metadata.availableBitrates.length - 1]);
        }

        return;
      }

      if (message === "thumbnail:done") {
        const currentLanguage = useSettingsStore.getState().language;
        const locale = getLocaleMessages(currentLanguage);
        sendNativeNotification(
          locale.notifications.thumbnailDownloadedTitle,
          locale.notifications.thumbnailDownloadedMessage,
        );
        return;
      }

      if (message === "thumbnail:error") {
        const currentLanguage = useSettingsStore.getState().language;
        const locale = getLocaleMessages(currentLanguage);
        sendNativeNotification(
          locale.notifications.thumbnailDownloadFailedTitle,
          locale.notifications.thumbnailDownloadFailedMessage,
        );
        return;
      }

      const playlistProgress = parsePlaylistMessage(message);
      if (playlistProgress != null) {
        setPlaylistProgress(playlistProgress.current, playlistProgress.total);
        return;
      }

      const progress = parseProgressMessage(message);
      if (progress != null) {
        setProgress(progress);
        return;
      }

      const statusMessage = parseDownloadStatusMessage(message);
      if (statusMessage == null) {
        return;
      }

      if (statusMessage === "status:downloading") {
        markDownloading();
        return;
      }

      if (statusMessage === "status:merging") {
        markMerging();
        return;
      }

      if (statusMessage === "status:converting") {
        markConverting();
        return;
      }

      if (statusMessage === "status:done") {
        const currentLanguage = useSettingsStore.getState().language;
        const locale = getLocaleMessages(currentLanguage);
        sendNativeNotification(
          locale.notifications.downloadCompletedTitle,
          locale.notifications.downloadCompletedMessage,
        );
        markDone();
        return;
      }

      if (statusMessage === "status:error") {
        markError();
        return;
      }

      if (statusMessage === "status:idle" || statusMessage === "status:canceled") {
        markIdle();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [
    applyMetadata,
    markConverting,
    markDownloading,
    markMerging,
    markIdle,
    markDone,
    markError,
    markFetchError,
    setBitrate,
    setFPS,
    setPlaylistProgress,
    setProgress,
    setResolution,
  ]);
}
