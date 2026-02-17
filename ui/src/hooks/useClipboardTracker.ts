import { useEffect } from "react";
import { postWebViewMessage, subscribeWebViewMessages } from "@/lib/webview";
import { useClipboardStore } from "@/stores/clipboardStore";

const CLIPBOARD_UPDATED_PREFIX = "clipboard_updated:";

function parseClipboardUpdateMessage(message: string): string | null {
  if (!message.startsWith(CLIPBOARD_UPDATED_PREFIX)) {
    return null;
  }

  return message.slice(CLIPBOARD_UPDATED_PREFIX.length);
}

export function useClipboardTracker(): void {
  const setClipboardText = useClipboardStore((state) => state.setText);

  useEffect(() => {
    const unsubscribe = subscribeWebViewMessages((event) => {
      const clipboardText = parseClipboardUpdateMessage(event.data);
      if (clipboardText == null) {
        return;
      }

      setClipboardText(clipboardText);
    });

    postWebViewMessage("request_clipboard_text");

    return unsubscribe;
  }, [setClipboardText]);
}
