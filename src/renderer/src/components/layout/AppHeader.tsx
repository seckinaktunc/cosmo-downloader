import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getMetadataAutoFetchKey } from '../../lib/metadataAutoFetch';
import { getValidClipboardUrl } from '../../lib/urlInput';
import { cn } from '../../lib/utils';
import { useDownloadStore } from '../../stores/downloadStore';
import { useQueueStore } from '../../stores/queueStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUiStore } from '../../stores/uiStore';
import { useVideoStore } from '../../stores/videoStore';
import { ActionMenu, type ActionMenuAnchor } from '../ui/ActionMenu';
import { Button } from '../ui/Button';

export function AppHeader(): React.JSX.Element {
  const { t } = useTranslation();
  const settings = useSettingsStore((state) => state.settings);
  const url = useVideoStore((state) => state.url);
  const setUrl = useVideoStore((state) => state.setUrl);
  const clear = useVideoStore((state) => state.clear);
  const fetchMetadata = useVideoStore((state) => state.fetchMetadata);
  const stage = useVideoStore((state) => state.stage);
  const resetDownload = useDownloadStore((state) => state.reset);
  const activeQueueItemId = useQueueStore((state) => state.activeItemId);
  const activePanel = useUiStore((state) => state.activePanel);
  const toggleMediaPanel = useUiStore((state) => state.toggleMediaPanel);
  const updateSettings = useSettingsStore((state) => state.update);
  const environment = useSettingsStore((state) => state.environment);
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const [contextMenuAnchor, setContextMenuAnchor] = useState<ActionMenuAnchor | null>(null);
  const latestSettingsRef = useRef(settings);
  const metadataAutoFetchKey = getMetadataAutoFetchKey(url, settings);

  const refreshClipboardUrl = useCallback(async (): Promise<string | null> => {
    if (url.trim().length > 0) {
      setClipboardUrl(null);
      return null;
    }

    const result = await window.cosmo.clipboard.readText();
    const nextClipboardUrl = result.ok ? getValidClipboardUrl(result.data) : null;
    setClipboardUrl(nextClipboardUrl);
    return nextClipboardUrl;
  }, [url]);

  useEffect(() => {
    latestSettingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (!metadataAutoFetchKey) {
      return;
    }

    const timer = window.setTimeout(() => {
      const latestSettings = latestSettingsRef.current;
      if (latestSettings) {
        void fetchMetadata(latestSettings);
      }
    }, 600);

    return () => window.clearTimeout(timer);
  }, [fetchMetadata, metadataAutoFetchKey]);

  useEffect(() => {
    const refresh = (): void => {
      void refreshClipboardUrl();
    };
    const timer = window.setTimeout(refresh, 0);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [refreshClipboardUrl]);

  const handleUrlChange = (nextUrl: string): void => {
    setUrl(nextUrl);
    if (!activeQueueItemId) {
      resetDownload();
    }
  };

  const handleClear = (): void => {
    clear();
    if (!activeQueueItemId) {
      resetDownload();
    }
  };

  const handlePaste = async (): Promise<void> => {
    const nextClipboardUrl = clipboardUrl ?? (await refreshClipboardUrl());
    if (!nextClipboardUrl) {
      return;
    }

    handleUrlChange(nextClipboardUrl);
  };

  const handleSearchAction = (): void => {
    if (url.trim().length > 0) {
      handleClear();
      return;
    }

    void handlePaste();
  };

  const toggleAlwaysOnTop = async (): Promise<void> => {
    if (!settings) {
      return;
    }

    const alwaysOnTop = !settings.alwaysOnTop;
    const result = await window.cosmo.window.setAlwaysOnTop(alwaysOnTop);
    if (result.ok) {
      await updateSettings({ alwaysOnTop });
    }
  };

  const handleHeaderPointerDownCapture = (event: React.PointerEvent<HTMLElement>): void => {
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, select, [contenteditable="true"]')) {
      return;
    }

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const isMac = environment?.platform === 'darwin';
  const headerActions = (
    <>
      <Button
        variant="ghost"
        icon={settings?.alwaysOnTop ? 'pinFilled' : 'pin'}
        tooltip={t('actions.pin')}
        size="icon"
        isActive={settings?.alwaysOnTop}
        onClick={() => void toggleAlwaysOnTop()}
        className="no-drag"
      />
      <Button
        variant="ghost"
        icon="history"
        tooltip={t('actions.history')}
        size="icon"
        isActive={activePanel === 'history'}
        onClick={() => toggleMediaPanel('history')}
        className="no-drag"
      />
    </>
  );
  const actionIcon =
    stage === 'fetching_metadata'
      ? 'spinner'
      : url.trim().length > 0
        ? 'close'
        : clipboardUrl
          ? 'paste'
          : 'search';
  const actionLabel =
    url.trim().length > 0
      ? t('actions.clear')
      : clipboardUrl
        ? t('actions.paste')
        : t('search.action');

  return (
    <header
      className={cn(
        'drag-region grid min-h-16 grid-cols-[1fr_minmax(20rem,36rem)_1fr] items-center gap-6 bg-black p-2'
      )}
    >
      <div className="flex items-center" onPointerDownCapture={handleHeaderPointerDownCapture}>
        {!isMac ? headerActions : null}
      </div>

      <div
        className="no-drag relative flex h-12 items-center"
        onPointerDownCapture={handleHeaderPointerDownCapture}
        onContextMenu={(event) => {
          event.preventDefault();
          void refreshClipboardUrl();
          setContextMenuAnchor({ type: 'point', x: event.clientX, y: event.clientY });
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
        <Button
          variant="ghost"
          icon={stage === 'fetching_metadata' ? 'spinner' : actionIcon}
          className="absolute right-0 top-0"
          size="icon-lg"
          onClick={handleSearchAction}
          aria-label={actionLabel}
          disabled={stage === 'fetching_metadata'}
        />
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

      <div
        className="no-drag flex items-center justify-end"
        onPointerDownCapture={handleHeaderPointerDownCapture}
      >
        {isMac ? headerActions : null}
      </div>
    </header>
  );
}
