import { useEffect } from 'react';
import { AppHeader } from './components/layout/AppHeader';
import { BottomBar } from './components/layout/BottomBar';
import { MainContent } from './components/layout/MainContent';
import { UpdatePrompt } from './components/features/UpdatePrompt';
import { useDownloadStore } from './stores/downloadStore';
import { useHistoryStore } from './stores/historyStore';
import { useQueueStore } from './stores/queueStore';
import { useSettingsStore } from './stores/settingsStore';
import { useUpdateStore } from './stores/updateStore';
import { useVideoStore } from './stores/videoStore';

export default function App(): React.JSX.Element {
  const loadSettings = useSettingsStore((state) => state.load);
  const subscribeToDownloads = useDownloadStore((state) => state.subscribe);
  const loadQueue = useQueueStore((state) => state.load);
  const subscribeToQueue = useQueueStore((state) => state.subscribe);
  const loadHistory = useHistoryStore((state) => state.load);
  const subscribeToHistory = useHistoryStore((state) => state.subscribe);
  const loadUpdates = useUpdateStore((state) => state.load);
  const subscribeToUpdates = useUpdateStore((state) => state.subscribe);
  const subscribeToVideo = useVideoStore((state) => state.subscribe);

  useEffect(() => {
    void loadSettings();
    void loadQueue();
    void loadHistory();
    void loadUpdates();
    subscribeToDownloads();
    subscribeToQueue();
    subscribeToHistory();
    subscribeToUpdates();
    subscribeToVideo();
  }, [
    loadHistory,
    loadQueue,
    loadSettings,
    loadUpdates,
    subscribeToDownloads,
    subscribeToHistory,
    subscribeToQueue,
    subscribeToUpdates,
    subscribeToVideo
  ]);

  return (
    <div className="grid h-screen grid-rows-[auto_minmax(0,1fr)_auto] bg-black text-white select-none">
      <AppHeader />
      <MainContent />
      <BottomBar />
      <UpdatePrompt />
    </div>
  );
}
