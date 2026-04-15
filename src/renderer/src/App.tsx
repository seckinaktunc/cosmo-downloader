import { useEffect } from 'react'
import { AppHeader } from './components/layout/AppHeader'
import { BottomBar } from './components/layout/BottomBar'
import { MainContent } from './components/layout/MainContent'
import { useDownloadStore } from './stores/downloadStore'
import { useSettingsStore } from './stores/settingsStore'

export default function App(): React.JSX.Element {
  const loadSettings = useSettingsStore((state) => state.load)
  const subscribeToDownloads = useDownloadStore((state) => state.subscribe)

  useEffect(() => {
    void loadSettings()
    subscribeToDownloads()
  }, [loadSettings, subscribeToDownloads])

  return (
    <div className="grid h-screen grid-rows-[auto_minmax(0,1fr)_auto] bg-black text-white select-none">
      <AppHeader />
      <MainContent />
      <BottomBar />
    </div>
  )
}
