import { useTranslation } from 'react-i18next'
import { formatDuration, formatStageHeadline, formatTransferDetail } from '../../lib/formatters'
import { useDownloadStore } from '../../stores/downloadStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useUiStore } from '../../stores/uiStore'
import { useVideoStore } from '../../stores/videoStore'
import Icon from '../miscellaneous/Icon'
import { Button } from '../ui/Button'

const ACTIVE_STAGES = ['downloading', 'processing']

export function BottomBar(): React.JSX.Element {
  const { t } = useTranslation()
  const metadata = useVideoStore((state) => state.metadata)
  const videoStage = useVideoStore((state) => state.stage)
  const settings = useSettingsStore((state) => state.settings)
  const exportSettings = useUiStore((state) => state.exportSettings)
  const activePanel = useUiStore((state) => state.activePanel)
  const setActivePanel = useUiStore((state) => state.setActivePanel)
  const downloadStage = useDownloadStore((state) => state.stage)
  const progress = useDownloadStore((state) => state.progress)
  const start = useDownloadStore((state) => state.start)
  const canDownload = metadata != null && settings != null && videoStage === 'ready'
  const isActive = ACTIVE_STAGES.includes(downloadStage)
  const isComplete = downloadStage === 'completed'
  const percent = progress?.percentage ?? 0

  return (
    <footer className="grid grid-cols-[1fr_auto] items-center gap-2 bg-black p-2">
      <div className="flex min-w-0 max-w-[75%] items-center gap-3">
        <div className="relative aspect-video h-16 overflow-hidden rounded-lg bg-white/10 shrink-0">
          {metadata?.thumbnail ? (
            <img
              src={metadata.thumbnail}
              alt=""
              className="size-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : null}
          {metadata?.duration && (
            <span className="absolute bottom-1 right-1 bg-black/50 px-1 py-0.5 rounded-sm text-sm font-bold">
              {formatDuration(metadata.duration)}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-col items-start">
          {metadata?.platform ? (
            <span className="text-sm font-bold uppercase tracking-wide text-primary">
              {metadata.platform}
            </span>
          ) : null}
          <a
            href={metadata?.webpageUrl}
            target="_blank"
            rel="noreferrer"
            className="block max-w-full truncate font-bold underline-offset-2 hover:underline text-white"
          >
            {metadata?.title ?? 'No video selected'}
          </a>
          <a
            href={metadata?.uploader}
            target="_blank"
            rel="noreferrer"
            className="block max-w-full truncate text-sm underline-offset-2 hover:underline text-white/50"
          >
            {metadata?.uploader ?? 'Paste a video link to begin'}
          </a>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {metadata &&
          <div className="flex min-w-0 items-center justify-end gap-3">
            <div className="flex min-w-0 flex-col items-end">
              <span className="truncate text-white font-bold">
                {formatStageHeadline(progress, downloadStage) || t(`download.${downloadStage}`)}
              </span>
              <span className="truncate text-sm text-white/50">
                {formatTransferDetail(progress)}
              </span>
            </div>
            {isActive ? (
              <Icon name="spinner" size={24} className="animate-spin opacity-60" />
            ) : null}
          </div>
        }

        <Button
          icon={
            isActive
              ? 'close'
              : isComplete
                ? 'reload'
                : downloadStage === 'downloading'
                  ? 'spinner'
                  : 'download'
          }
          label={
            isActive
              ? 'Cancel'
              : isComplete
                ? 'Download New'
                : downloadStage === 'downloading'
                  ? 'In progress...'
                  : 'Download Video'
          }
          active={activePanel === 'export'}
          disabled={!canDownload && !isActive}
          onClick={() => {
            if (!metadata || !settings) return
            void start(metadata, exportSettings, settings)
          }}
          size="xl"
          aria-label={isActive ? t('actions.cancel') : t('actions.download')}
        />

        <div className="flex gap-1">
          <Button
            icon="adjustments"
            label={t('actions.exportSettings')}
            tooltip={t('actions.exportSettings')}
            onlyIcon
            ghost
            active={activePanel === 'export'}
            onClick={() => setActivePanel(activePanel === 'export' ? null : 'export')}
          />
          <Button
            icon="settings"
            label={t('actions.settings')}
            tooltip={t('actions.settings')}
            onlyIcon
            ghost
            active={activePanel === 'settings'}
            onClick={() => setActivePanel(activePanel === 'settings' ? null : 'settings')}
          />
        </div>
      </div>

      <div className="col-span-3 h-2 overflow-hidden rounded-lg bg-white/10">
        <div
          className="h-full rounded-lg bg-primary transition-all"
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
    </footer>
  )
}
