import { useCallback } from "react";
import { postWebViewMessage } from "@/lib/webview";

export function useCancelDownload() {
  const cancelDownload = useCallback(() => {
    return postWebViewMessage("cancel_download");
  }, []);

  return cancelDownload;
}
