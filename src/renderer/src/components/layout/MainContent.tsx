import { useRef } from 'react'
import {
  MEDIA_OVERVIEW_MAX_WIDTH,
  MEDIA_OVERVIEW_MIN_WIDTH,
  useUiStore
} from '../../stores/uiStore'
import { ExportSettingsPanel } from '../features/ExportSettingsPanel'
import { MediaOverview } from '../features/MediaOverview'
import { SettingsPanel } from '../features/SettingsPanel'
import { ResizeHandle } from '../ui/ResizeHandle'

export function MainContent(): React.JSX.Element {
  const containerRef = useRef<HTMLElement | null>(null)
  const activeContent = useUiStore((state) => state.activeContent)
  const setActiveContent = useUiStore((state) => state.setActiveContent)
  const mediaOverviewWidthPercent = useUiStore((state) => state.mediaOverviewWidthPercent)
  const setMediaOverviewWidthPercent = useUiStore((state) => state.setMediaOverviewWidthPercent)

  const panel = activeContent === 'settings' ? <SettingsPanel /> : <ExportSettingsPanel />

  return (
    <main
      ref={containerRef}
      className="grid min-h-0 px-2"
      style={{
        gridTemplateColumns: `${mediaOverviewWidthPercent}% 0.5rem minmax(0, 1fr)`
      }}
    >
      <aside className="min-h-0 min-w-0 overflow-hidden rounded-lg bg-linear-to-b from-dark to-white/10 border border-white/10">
        <MediaOverview />
      </aside>
      <ResizeHandle
        value={mediaOverviewWidthPercent}
        min={MEDIA_OVERVIEW_MIN_WIDTH}
        max={MEDIA_OVERVIEW_MAX_WIDTH}
        onChange={setMediaOverviewWidthPercent}
        containerRef={containerRef}
        label="Resize media overview"
      />
      <div className="min-h-0 overflow-y-auto rounded-lg bg-linear-to-b from-dark to-white/10 border border-white/10">
        <div className="flex w-full divide-x divide-white/10">
          <div
            className={`py-2 px-3 flex-1 text-white/50 text-center ${activeContent !== 'export' ? 'bg-black/50 border-b border-white/10' : 'bg-linear-to-t from-transparent to-white/10'}`}
            onClick={() => setActiveContent('export')}
          >
            Export Settings
          </div>
          <div
            className={`py-2 px-3 flex-1 text-white/50 text-center ${activeContent !== 'settings' ? 'bg-black/50 border-b border-white/10' : 'bg-linear-to-t from-transparent to-white/10'}`}
            onClick={() => setActiveContent('settings')}
          >
            Preferences
          </div>
        </div>
        {panel}
      </div>
    </main>
  )
}
