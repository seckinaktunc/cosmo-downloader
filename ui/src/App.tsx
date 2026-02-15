import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import ControlBar from "@/components/layout/ControlBar";
import DownloadStatusPanel from "@/components/layout/DownloadStatusPanel";
import Preferences from "@/components/layout/Preferences";
import Settings from "@/components/layout/Settings";
import WindowBar from "@/components/layout/WindowBar";
import { useDownloadEvents } from "@/hooks/useDownloadState";
import { useWindowResize } from "@/hooks/useWindowResize";
import { useGlobalStore } from "@/stores/globalStore";
import { useSettingsStore } from "@/stores/settingsStore";

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isVisible = useGlobalStore((state) => state.isVisible);
  const isPinned = useGlobalStore((state) => state.isPinned);
  const language = useSettingsStore((state) => state.language);
  const exitAction = useGlobalStore((state) => state.exitAction);
  const setVisible = useGlobalStore((state) => state.setVisible);
  const setExitAction = useGlobalStore((state) => state.setExitAction);

  useWindowResize(containerRef, isVisible);
  useDownloadEvents();

  useEffect(() => {
    const handleMessage = (event: any) => {
      const data = event.data;

      if (data === "window_restored") {
        setExitAction(null);
        setVisible(true);
      }
      else if (data === "request_minimize") {
        setExitAction('minimize');
        setVisible(false);
      }
    };

    window.addEventListener("message", handleMessage);
    if (window.chrome?.webview?.addEventListener) {
      window.chrome.webview.addEventListener('message', handleMessage);
    }

    setTimeout(() => {
      window.chrome?.webview?.postMessage("show_window");
      setTimeout(() => setVisible(true), 50);
    }, 100);

    return () => {
      window.removeEventListener("message", handleMessage);
      window.chrome?.webview?.removeEventListener?.('message', handleMessage);
    };
  }, [setVisible, setExitAction]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const onExitComplete = () => {
    if (exitAction === 'minimize') {
      window.chrome?.webview?.postMessage("minimize_window");
    } else if (exitAction === 'close') {
      window.chrome?.webview?.postMessage("close_window");
    }
  };

  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {isVisible && (
        <motion.div
          ref={containerRef}
          className="flex flex-col w-160 bg-transparent p-2 gap-1 font-sans antialiased origin-bottom"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: isPinned ? 0.9 : 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <WindowBar />
          <ControlBar />
          <Preferences />
          <Settings />
          <DownloadStatusPanel />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
