import { useEffect, useRef } from "react";
import { getLocaleMessages } from "../locale";
import { subscribeWebViewMessages } from "../lib/webview";
import { useDownloadStore } from "../stores/downloadStore";
import { useSettingsStore } from "../stores/settingsStore";
import type { DownloadState } from "../types/download";
import { sendNativeNotification } from "../utils/notification";

function parseProgress(message: string): number | null {
  const prefix = "status:progress:";
  if (!message.startsWith(prefix)) {
    return null;
  }

  const parsed = Number.parseInt(message.slice(prefix.length), 10);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return Math.min(100, Math.max(0, parsed));
}

export function useDownloadState(): DownloadState {
  const status = useDownloadStore((state) => state.status);
  const progress = useDownloadStore((state) => state.progress);
  return { status, progress };
}

export function useDownloadEvents(): void {
  const setProgress = useDownloadStore((state) => state.setProgress);
  const markDownloading = useDownloadStore((state) => state.markDownloading);
  const markDone = useDownloadStore((state) => state.markDone);
  const markError = useDownloadStore((state) => state.markError);
  const reset = useDownloadStore((state) => state.reset);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearResetTimer = () => {
      if (resetTimerRef.current == null) {
        return;
      }

      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    };

    const unsubscribe = subscribeWebViewMessages((event) => {
      const message = event.data;
      const progress = parseProgress(message);
      if (progress != null) {
        setProgress(progress);
        return;
      }

      if (message === "status:downloading") {
        clearResetTimer();
        markDownloading();
        return;
      }

      if (message === "status:done") {
        const currentLanguage = useSettingsStore.getState().language;
        const locale = getLocaleMessages(currentLanguage);
        sendNativeNotification(
          locale.notifications.downloadCompletedTitle,
          locale.notifications.downloadCompletedMessage,
        );
        markDone();
        return;
      }

      if (message === "status:error") {
        markError();
        return;
      }

      if (message === "status:idle") {
        clearResetTimer();
        reset();
      }
    });

    return () => {
      clearResetTimer();
      unsubscribe();
    };
  }, [markDownloading, markDone, markError, reset, setProgress]);
}
