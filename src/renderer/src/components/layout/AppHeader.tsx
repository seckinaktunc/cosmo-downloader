import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from '../miscellaneous/Icon'
import { cn } from '../../lib/utils'
import { getValidClipboardUrl } from '../../lib/urlInput'
import { useSettingsStore } from '../../stores/settingsStore'
import { useVideoStore } from '../../stores/videoStore'
import { Button } from '../ui/Button'
import { useDownloadStore } from '../../stores/downloadStore'
import { useQueueStore } from '../../stores/queueStore'
import { useUiStore } from '../../stores/uiStore'
import { ActionMenu, type ActionMenuAnchor } from '../ui/ActionMenu'

export function AppHeader(): React.JSX.Element {
  const { t } = useTranslation()
  const settings = useSettingsStore((state) => state.settings)
  const url = useVideoStore((state) => state.url)
  const setUrl = useVideoStore((state) => state.setUrl)
  const clear = useVideoStore((state) => state.clear)
  const fetchMetadata = useVideoStore((state) => state.fetchMetadata)
  const stage = useVideoStore((state) => state.stage)
  const resetDownload = useDownloadStore((state) => state.reset)
  const activeQueueItemId = useQueueStore((state) => state.activeItemId)
  const activePanel = useUiStore((state) => state.activePanel)
  const toggleMediaPanel = useUiStore((state) => state.toggleMediaPanel)
  const updateSettings = useSettingsStore((state) => state.update)
  const environment = useSettingsStore((state) => state.environment)
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null)
  const [contextMenuAnchor, setContextMenuAnchor] = useState<ActionMenuAnchor | null>(null)

  const refreshClipboardUrl = useCallback(async (): Promise<string | null> => {
    if (url.trim().length > 0) {
      setClipboardUrl(null)
      return null
    }

    const result = await window.cosmo.clipboard.readText()
    const nextClipboardUrl = result.ok ? getValidClipboardUrl(result.data) : null
    setClipboardUrl(nextClipboardUrl)
    return nextClipboardUrl
  }, [url])

  useEffect(() => {
    if (!settings || url.trim().length === 0) {
      return
    }

    const timer = window.setTimeout(() => {
      void fetchMetadata(settings)
    }, 600)

    return () => window.clearTimeout(timer)
  }, [fetchMetadata, settings, url])

  useEffect(() => {
    const refresh = (): void => {
      void refreshClipboardUrl()
    }
    const timer = window.setTimeout(refresh, 0)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [refreshClipboardUrl])

  const handleUrlChange = (nextUrl: string): void => {
    setUrl(nextUrl)
    if (!activeQueueItemId) {
      resetDownload()
    }
  }

  const handleClear = (): void => {
    clear()
    if (!activeQueueItemId) {
      resetDownload()
    }
  }

  const handlePaste = async (): Promise<void> => {
    const nextClipboardUrl = clipboardUrl ?? (await refreshClipboardUrl())
    if (!nextClipboardUrl) {
      return
    }

    handleUrlChange(nextClipboardUrl)
  }

  const handleSearchAction = (): void => {
    if (url.trim().length > 0) {
      handleClear()
      return
    }

    void handlePaste()
  }

  const toggleAlwaysOnTop = async (): Promise<void> => {
    if (!settings) {
      return
    }

    const alwaysOnTop = !settings.alwaysOnTop
    const result = await window.cosmo.window.setAlwaysOnTop(alwaysOnTop)
    if (result.ok) {
      await updateSettings({ alwaysOnTop })
    }
  }

  const isMac = environment?.platform === 'darwin'
  const headerActions = (
    <>
      <Button
        icon={settings?.alwaysOnTop ? 'pinFilled' : 'pin'}
        label={t('actions.pin')}
        tooltip={t('actions.pin')}
        onlyIcon
        ghost
        active={settings?.alwaysOnTop}
        onClick={() => void toggleAlwaysOnTop()}
      />
      <Button
        icon="history"
        label={t('actions.history')}
        tooltip={t('actions.history')}
        onlyIcon
        ghost
        active={activePanel === 'history'}
        onClick={() => toggleMediaPanel('history')}
      />
    </>
  )
  const actionIcon =
    stage === 'fetching_metadata'
      ? 'spinner'
      : url.trim().length > 0
        ? 'close'
        : clipboardUrl
          ? 'paste'
          : 'search'
  const actionLabel =
    url.trim().length > 0
      ? t('actions.clear')
      : clipboardUrl
        ? t('actions.paste')
        : t('search.action')

  return (
    <header
      className={cn(
        'drag-region grid min-h-16 grid-cols-[1fr_minmax(20rem,36rem)_1fr] items-center gap-6 bg-black p-2'
      )}
      onMouseDown={(event) => {
        const target = event.target as HTMLElement
        if (
          target.closest(
            'input, textarea, select, button, a, [contenteditable="true"], [role="button"]'
          )
        ) {
          return
        }
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur()
        }
      }}
    >
      <div className="flex items-center">{!isMac ? headerActions : null}</div>

      <div
        className="no-drag relative flex h-12 items-center"
        onContextMenu={(event) => {
          event.preventDefault()
          void refreshClipboardUrl()
          setContextMenuAnchor({ type: 'point', x: event.clientX, y: event.clientY })
        }}
      >
        <input
          className="size-full rounded-lg border border-white/10 bg-white/10 pl-4 pr-12 text-white outline-none transition placeholder:text-white/40 focus:border-white/40"
          placeholder={t('search.placeholder')}
          value={url}
          onChange={(event) => handleUrlChange(event.currentTarget.value)}
          aria-label={t('search.placeholder')}
          onFocus={() => void refreshClipboardUrl()}
        />
        <button
          className="absolute right-1 inline-flex size-10 items-center justify-center rounded-lg text-white outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/70"
          type="button"
          onClick={handleSearchAction}
          aria-label={actionLabel}
          disabled={stage === 'fetching_metadata'}
        >
          <Icon
            name={stage === 'fetching_metadata' ? 'spinner' : actionIcon}
            size={22}
            className="opacity-70"
          />
        </button>
        <ActionMenu
          open={contextMenuAnchor != null}
          anchor={contextMenuAnchor}
          ariaLabel={t('search.contextMenu')}
          onClose={() => setContextMenuAnchor(null)}
          items={[
            {
              id: 'paste',
              label: t('actions.paste'),
              icon: 'paste',
              disabled: clipboardUrl == null,
              onSelect: () => void handlePaste()
            },
            {
              id: 'clear',
              label: t('actions.clear'),
              icon: 'close',
              disabled: url.trim().length === 0,
              onSelect: handleClear
            }
          ]}
        />
      </div>

      <div className="flex items-center justify-end">{isMac ? headerActions : null}</div>
    </header>
  )
}
