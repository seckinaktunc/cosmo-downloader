import Icon from '@renderer/components/miscellaneous/Icon';
import Button from '@renderer/components/ui/Button';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SplashEvent, UpdateState } from '../../../shared/types';
import { resolveSupportedLocale } from '../i18n';
import { formatBytes } from '../lib/formatters';

export function SplashApp(): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState<UpdateState>({ status: 'idle' });
  const [showContinueLink, setShowContinueLink] = useState(false);
  const [autoCloseSeconds, setAutoCloseSeconds] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    void window.cosmo.settings.get().then((result) => {
      if (!cancelled && result.ok)
        void i18n.changeLanguage(resolveSupportedLocale(result.data.interfaceLanguage));
    });

    void window.cosmo.updates.getState().then((result) => {
      if (!cancelled && result.ok) setState(result.data);
    });

    const unsubscribeState = window.cosmo.updates.onState((next) => {
      setState(next);
    });

    const unsubscribeSplash = window.cosmo.updates.onSplashEvent((event: SplashEvent) => {
      if (event.kind === 'show-continue-link') {
        setShowContinueLink(true);
      } else if (event.kind === 'auto-close-soon') {
        setAutoCloseSeconds(Math.ceil(event.delayMs / 1000));
      }
    });

    return () => {
      cancelled = true;
      unsubscribeState();
      unsubscribeSplash();
    };
  }, [i18n]);

  useEffect(() => {
    if (autoCloseSeconds == null) return;
    if (autoCloseSeconds <= 0) return;

    const handle = window.setTimeout(() => {
      setAutoCloseSeconds(autoCloseSeconds - 1);
    }, 1000);

    return () => window.clearTimeout(handle);
  }, [autoCloseSeconds]);

  const version = state.updateInfo?.version ?? '';
  const transferred = state.progress?.transferred;
  const total = state.progress?.total;
  const percent = Math.max(0, Math.min(100, Math.round(state.progress?.percent ?? 0)));

  const headline = useMemo(() => {
    if (autoCloseSeconds != null) return t('updates.splash.errorStarting');
    if (state.status === 'downloaded') return t('updates.splash.installing');

    return t('updates.splash.downloading', { version });
  }, [autoCloseSeconds, state.status, t, version]);

  const progressLabel =
    transferred != null && total != null && total > 0
      ? t('updates.splash.progress', {
          transferred: formatBytes(transferred),
          total: formatBytes(total)
        })
      : null;

  const showIndeterminate = state.status === 'downloaded' || autoCloseSeconds != null;

  const handleContinue = (): void => {
    void window.cosmo.updates.continueWithoutUpdate();
  };

  const handleViewChangelog = (): void => {
    if (!version) return;
    void window.cosmo.updates.openReleasePage(version);
  };

  return (
    <div className="drag-region flex h-screen w-screen flex-col items-center justify-center gap-4 bg-linear-to-b from-dark to-gray p-8 text-white select-none">
      <div className="flex flex-col w-full gap-6">
        <div className="relative flex items-center justify-center">
          <Icon name="appIcon" size={80} />
          <div className="absolute size-16 animate-pulse rounded-full bg-white blur-[3rem]" />
        </div>
        <div className="flex flex-col items-center w-full gap-2">
          <span className="text-base font-medium">{headline}</span>
          <div className="col-span-3 w-full h-2 overflow-hidden rounded-lg bg-white/10 box-content border border-white/10">
            {showIndeterminate ? (
              <div className="h-full w-1/3 animate-pulse rounded-full bg-white/70" />
            ) : (
              <div
                className="h-full rounded-lg bg-linear-to-r from-primary/50 to-primary bg-no-repeat transition-all"
                style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
              />
            )}
          </div>

          {progressLabel ? (
            <span className="text-xs text-white/50">{progressLabel}</span>
          ) : (
            <Icon name="spinner" size={16} className="opacity-50" />
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          icon="logs"
          label={t('updates.splash.viewChangelog')}
          onClick={handleViewChangelog}
          disabled={!version}
          className=" no-drag"
          rounded
          ripple
        />
        {showContinueLink && autoCloseSeconds == null && (
          <Button
            variant="secondary"
            icon="chevronsRight"
            iconPosition="end"
            label={t('updates.splash.continueLink')}
            onClick={handleContinue}
            className=" no-drag"
            rounded
            ripple
          />
        )}
      </div>
    </div>
  );
}
