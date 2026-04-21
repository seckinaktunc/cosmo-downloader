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
import ContentTab, { ContentTabItem } from '../features/ContentTab'
import { LogsPanel } from '../features/LogsPanel'

export function MainContent(): React.JSX.Element {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLElement | null>(null)
  const mediaOverviewWidthPercent = useUiStore((state) => state.mediaOverviewWidthPercent)
  const setMediaOverviewWidthPercent = useUiStore((state) => state.setMediaOverviewWidthPercent)

  const tabs: ContentTabItem[] = [
    {
      id: 'export',
      title: t('export.title'),
      icon: 'adjustments',
      content: <ExportSettingsPanel />
    },
    {
      id: 'settings',
      title: t('settings.title'),
      icon: 'settings',
      content: <SettingsPanel />
    },
    { id: 'logs', icon: 'logs', content: <LogsPanel /> }
  ]

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
      <ContentTab tabs={tabs} />
    </main>
  )
}
