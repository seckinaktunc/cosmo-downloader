import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
        label={t('layout.resizeMediaOverview')}
      />
      <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-linear-to-b from-dark to-white/10">
        <div className="flex w-full divide-x divide-white/10">
          <div
            className={`py-2 px-3 flex-1 text-center ${activeContent !== 'export' ? 'bg-black border-b border-white/10 text-white/50 hover:bg-dark cursor-pointer' : 'bg-dark text-white'}`}
            onClick={() => activeContent !== 'export' && setActiveContent('export')}
          >
            {t('export.title')}
          </div>
          <div
            className={`py-2 px-3 flex-1 text-center ${activeContent !== 'settings' ? 'bg-black border-b border-white/10 text-white/50 hover:bg-dark cursor-pointer' : 'bg-dark text-white'}`}
            onClick={() => activeContent !== 'settings' && setActiveContent('settings')}
          >
            {t('settings.title')}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{panel}</div>
      </div>
    </main>
  )
}
