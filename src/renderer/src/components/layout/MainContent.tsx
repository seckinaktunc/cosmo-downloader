import { useRef } from 'react'
import { ExportSettingsPanel } from '../features/ExportSettingsPanel'
import { MediaOverview } from '../features/MediaOverview'
import { SettingsPanel } from '../features/SettingsPanel'
import { ResizeHandle } from '../ui/ResizeHandle'
import {
  MEDIA_OVERVIEW_MAX_WIDTH,
  MEDIA_OVERVIEW_MIN_WIDTH,
  useUiStore
} from '../../stores/uiStore'

export function MainContent(): React.JSX.Element {
  const containerRef = useRef<HTMLElement | null>(null)
  const activePanel = useUiStore((state) => state.activePanel)
  const mediaOverviewWidthPercent = useUiStore((state) => state.mediaOverviewWidthPercent)
  const setMediaOverviewWidthPercent = useUiStore((state) => state.setMediaOverviewWidthPercent)

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
      <div className="min-h-0 overflow-y-auto rounded-lg p-3 bg-linear-to-b from-dark to-white/10 border border-white/10">
        {activePanel === 'settings' ? <SettingsPanel /> : <ExportSettingsPanel />}
      </div>
    </main>
  )
}
