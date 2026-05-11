import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MEDIA_OVERVIEW_MAX_WIDTH,
  MEDIA_OVERVIEW_MIN_WIDTH,
  useUiStore
} from '../../stores/uiStore';
import { ExportSettingsPanel } from '../features/ExportSettingsPanel';
import { MediaOverview } from '../features/MediaOverview';
import { PreferencesPanel } from '../features/PreferencesPanel';
import { ResizeHandle } from '../ui/ResizeHandle';
import ContentTab, { ContentTabItem } from '../features/ContentTab';
import { LogsPanel } from '../features/LogsPanel';

export function MainContent(): React.JSX.Element {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLElement | null>(null);
  const latestMinHeightRef = useRef(827);
  const mediaOverviewWidthPercent = useUiStore((state) => state.mediaOverviewWidthPercent);
  const setMediaOverviewWidthPercent = useUiStore((state) => state.setMediaOverviewWidthPercent);

  const updateMinimumWindowHeight = useCallback(
    ({
      contentHeight,
      viewportHeight
    }: {
      contentHeight: number;
      viewportHeight: number;
    }): void => {
      if (viewportHeight <= 0 || contentHeight <= 0) {
        return;
      }

      const chromeDelta = window.innerHeight - viewportHeight;
      const nextMinHeight = Math.round(chromeDelta + contentHeight);
      if (!Number.isFinite(nextMinHeight) || nextMinHeight <= 0) {
        return;
      }

      if (latestMinHeightRef.current === nextMinHeight) {
        return;
      }

      latestMinHeightRef.current = nextMinHeight;
      void window.cosmo.window.setMinimumHeight(nextMinHeight);
    },
    []
  );

  useEffect(() => {
    void window.cosmo.window.setMinimumHeight(latestMinHeightRef.current);
  }, []);

  const tabs: ContentTabItem[] = [
    {
      id: 'exportSettings',
      title: t('exportSettings.title'),
      icon: 'adjustments',
      keepMounted: true,
      content: <ExportSettingsPanel onMetricsChange={updateMinimumWindowHeight} />
    },
    {
      id: 'preferences',
      title: t('preferences.title'),
      icon: 'settings',
      content: <PreferencesPanel />
    },
    { id: 'logs', icon: 'logs', content: <LogsPanel /> }
  ];

  return (
    <main
      ref={containerRef}
      className="grid min-h-0 px-2"
      style={{
        gridTemplateColumns: `${mediaOverviewWidthPercent}% 0.5rem minmax(0, 1fr)`
      }}
    >
      <aside className="min-h-0 min-w-0 overflow-hidden rounded-lg bg-linear-to-b from-dark to-gray border border-white/10">
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
  );
}
