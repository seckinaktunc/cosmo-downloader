import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from '../miscellaneous/Icon'
import { cn } from '../../lib/utils'
import { useSettingsStore } from '../../stores/settingsStore'
import { useVideoStore } from '../../stores/videoStore'
import { Button } from '../ui/Button'

export function AppHeader(): React.JSX.Element {
  const { t } = useTranslation()
  const settings = useSettingsStore((state) => state.settings)
  const url = useVideoStore((state) => state.url)
  const setUrl = useVideoStore((state) => state.setUrl)
  const clear = useVideoStore((state) => state.clear)
  const fetchMetadata = useVideoStore((state) => state.fetchMetadata)
  const stage = useVideoStore((state) => state.stage)

  useEffect(() => {
    if (!settings || url.trim().length === 0) {
      return
    }

    const timer = window.setTimeout(() => {
      void fetchMetadata(settings)
    }, 600)

    return () => window.clearTimeout(timer)
  }, [fetchMetadata, settings, url])

  return (
    <header
      className={cn(
        'drag-region grid min-h-16 grid-cols-[1fr_minmax(20rem,36rem)_1fr] items-center gap-6 bg-black p-2'
      )}
    >
      <div className="flex items-center">
        <Button
          icon="pin"
          label={t('actions.history')}
          tooltip={t('actions.history')}
          onlyIcon
          ghost
        />
        <Button
          icon="history"
          label={t('actions.history')}
          tooltip={t('actions.history')}
          onlyIcon
          ghost
        />
      </div>

      <div className="no-drag relative flex h-12 items-center">
        <input
          className="size-full rounded-lg border border-white/10 bg-white/10 pl-4 pr-12 text-white outline-none transition placeholder:text-white/40 focus:border-white/40"
          placeholder={t('search.placeholder')}
          value={url}
          onChange={(event) => setUrl(event.currentTarget.value)}
          aria-label={t('search.placeholder')}
        />
        <button
          className="absolute right-1 inline-flex size-10 items-center justify-center rounded-lg text-white outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/70"
          type="button"
          onClick={clear}
          aria-label={t('actions.clear')}
        >
          {stage === 'fetching_metadata' ? (
            <Icon name="spinner" size={22} className="animate-spin opacity-70" />
          ) : (
            <Icon name="close" size={22} className="opacity-70" />
          )}
        </button>
      </div>

      <div className="flex items-center justify-end" aria-hidden />
    </header>
  )
}
