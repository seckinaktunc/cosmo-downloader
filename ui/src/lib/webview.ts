export interface WebViewMessageEvent {
  data: string;
}

type MessageListener = (event: WebViewMessageEvent) => void;

interface WebViewApi {
  postMessage: (message: string) => void;
  addEventListener: (type: "message", listener: MessageListener) => void;
  removeEventListener?: (type: "message", listener: MessageListener) => void;
}

declare global {
  interface Window {
    chrome?: {
      webview?: WebViewApi;
    };
  }
}

function getWebViewApi(): WebViewApi | null {
  return window.chrome?.webview ?? null;
}

export function postWebViewMessage(message: string): boolean {
  const webview = getWebViewApi();
  if (webview == null) {
    return false;
  }

  webview.postMessage(message);
  return true;
}

export function subscribeWebViewMessages(listener: MessageListener): () => void {
  const webview = getWebViewApi();
  if (webview == null) {
    return () => {};
  }

  webview.addEventListener("message", listener);
  return () => {
    webview.removeEventListener?.("message", listener);
  };
}
