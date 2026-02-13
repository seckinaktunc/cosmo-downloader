import { useEffect, type RefObject } from "react";
import { postWebViewMessage } from "../lib/webview";

export function useWindowResize(
  containerRef: RefObject<HTMLDivElement | null>,
  enabled: boolean
) {
  useEffect(() => {
    if (!enabled || containerRef.current == null) {
      return;
    }

    const element = containerRef.current;

    const updateSize = () => {
      if (!element) return;

      const width = element.offsetWidth;
      const height = element.offsetHeight;

      if (width > 0 && height > 0) {
        postWebViewMessage(`resize:${width},${height}`);
      }
    };

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(updateSize);
    });

    observer.observe(element);
    setTimeout(updateSize, 0);

    return () => observer.disconnect();
  }, [containerRef, enabled]);
}
