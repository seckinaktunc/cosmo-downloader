import { COOKIE_BROWSER_ICONS } from '@renderer/lib/constants';
import { formatBytes } from '@renderer/lib/formatters';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CookieBrowser, PreferencesSection } from '../../../../shared/types';
import { SUPPORTED_LOCALES, resolveSupportedLocale } from '../../i18n';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUpdateStore } from '../../stores/updateStore';
import AppIcon from '../miscellaneous/AppIcon';
import Icon from '../miscellaneous/Icon';
import { Button } from '../ui/Button';
import { CollapsibleSection } from '../ui/CollapsibleSection';
import { LocationSelector } from '../ui/LocationSelector';
import NumberField from '../ui/NumberField';
import { SelectField } from '../ui/SelectField';
import { Switch } from '../ui/Switch';
import { Tooltip } from '../ui/Tooltip';

export function PreferencesPanel(): React.JSX.Element {
  const { t } = useTranslation();
  const settings = useSettingsStore((state) => state.settings);
  const environment = useSettingsStore((state) => state.environment);
  const cookieBrowsers = useSettingsStore((state) => state.cookieBrowsers);
  const restartRequired = useSettingsStore((state) => state.restartRequired);
  const cacheSummary = useSettingsStore((state) => state.cacheSummary);
  const update = useSettingsStore((state) => state.update);
  const refreshCacheSummary = useSettingsStore((state) => state.refreshCacheSummary);
  const clearCache = useSettingsStore((state) => state.clearCache);
  const chooseDownloadDirectory = useSettingsStore((state) => state.chooseDownloadDirectory);
  const updateState = useUpdateStore((state) => state.state);
  const checkForUpdates = useUpdateStore((state) => state.checkNow);
  const downloadUpdate = useUpdateStore((state) => state.download);
  const installUpdate = useUpdateStore((state) => state.install);
  const [cacheLimitInput, setCacheLimitInput] = useState<string | null>(null);
  const [historyLimitInput, setHistoryLimitInput] = useState<string | null>(null);

  const commitCacheLimitInput = (nextInputValue?: string): void => {
    if (!settings) {
      return;
    }

    const nextInput = nextInputValue ?? cacheLimitInput ?? String(settings.cacheLimitMb);
    const parsed = Number(nextInput);
    if (!Number.isFinite(parsed)) {
      setCacheLimitInput(null);
      return;
    }

    const nextValue = Math.min(500, Math.max(1, Math.round(parsed)));
    if (nextValue !== settings.cacheLimitMb) {
      setCacheLimitInput(String(nextValue));
      void update({ cacheLimitMb: nextValue }).finally(() => {
        setCacheLimitInput(null);
      });
      return;
    }

    setCacheLimitInput(null);
  };

  const commitHistoryLimitInput = (): void => {
    if (!settings) {
      return;
    }

    const nextInput = historyLimitInput ?? String(settings.historyLimitItems);
    const parsed = Number(nextInput);
    if (!Number.isFinite(parsed)) {
      setHistoryLimitInput(null);
      return;
    }

    const nextValue = Math.min(5000, Math.max(1, Math.round(parsed)));
    if (nextValue !== settings.historyLimitItems) {
      setHistoryLimitInput(String(nextValue));
      void update({ historyLimitItems: nextValue }).finally(() => {
        setHistoryLimitInput(null);
      });
      return;
    }

    setHistoryLimitInput(null);
  };

  useEffect(() => {
    void refreshCacheSummary();
    const timer = window.setInterval(() => {
      void refreshCacheSummary();
    }, 1000);

    return () => window.clearInterval(timer);
  }, [refreshCacheSummary]);

  if (!settings) {
    return <div className="text-white/60">{t('preferences.loading')}</div>;
  }

  const updateSectionExpanded = (section: PreferencesSection, expanded: boolean): void => {
    void update({
      preferencesSectionsExpanded: {
        ...settings.preferencesSectionsExpanded,
        [section]: expanded
      }
    });
  };
  const appTitle = environment?.name ?? t('app.title');
  const appIdentity =
    environment?.version != null && environment.version.length > 0
      ? `${appTitle} v${environment.version}`
      : appTitle;

  return (
    <section className="grid divide-y divide-white/10 border-b border-white/10">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AppIcon className="w-12" />
            <div className="flex flex-col">
              <span className="font-bold">{appIdentity}</span>
              <span className="text-sm text-white/50 select-text">
                {updateState.error ??
                  updateState.unavailableReason ??
                  t(`updates.status.${updateState.status}`, {
                    version: updateState.updateInfo?.version,
                    percent: Math.round(updateState.progress?.percent ?? 0)
                  })}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {updateState.status === 'available' && (
              <Button
                variant="secondary"
                label={t('updates.download')}
                size="sm"
                onClick={() => void downloadUpdate()}
                ripple
              />
            )}
            {updateState.status === 'downloaded' && (
              <Button
                variant="secondary"
                label={t('updates.restartNow')}
                size="sm"
                onClick={() => void installUpdate()}
                ripple
              />
            )}
            <Button
              variant="secondary"
              icon={updateState.status === 'checking' ? 'spinner' : 'reload'}
              label={t('updates.checkNow')}
              size="sm"
              disabled={updateState.status === 'checking' || updateState.status === 'downloading'}
              onClick={() => void checkForUpdates()}
              ripple
            />
          </div>
        </div>
      </div>
      <CollapsibleSection
        title={t('preferences.sections.general')}
        expanded={settings.preferencesSectionsExpanded.general}
        onExpandedChange={(expanded) => updateSectionExpanded('general', expanded)}
      >
        <>
          <div className="p-4">
            <SelectField
              label={t('preferences.language')}
              value={resolveSupportedLocale(settings.interfaceLanguage)}
              options={SUPPORTED_LOCALES.map((locale) => ({
                ...locale,
                icon: locale.icon
              }))}
              onChange={(interfaceLanguage) => void update({ interfaceLanguage })}
            />
          </div>
          <div className="p-4">
            <SelectField<CookieBrowser>
              label={t('preferences.cookiesBrowser')}
              value={settings.cookiesBrowser}
              options={cookieBrowsers.map((browser) => ({
                value: browser.id,
                label: browser.label,
                icon: COOKIE_BROWSER_ICONS[browser.id]
              }))}
              onChange={(cookiesBrowser) => void update({ cookiesBrowser })}
              description={t('preferences.cookiesBrowserDescription')}
            />
          </div>
          <div className="p-4">
            <Switch
              label={t('preferences.hardwareAcceleration')}
              checked={settings.hardwareAcceleration}
              onChange={(hardwareAcceleration) => void update({ hardwareAcceleration })}
              description={t('preferences.hardwareAccelerationDescription')}
              error={restartRequired ? t('preferences.restartRequired') : undefined}
            />
          </div>
          <div className="p-4">
            <Switch
              label={t('preferences.automaticUpdates')}
              checked={settings.automaticUpdates}
              onChange={(automaticUpdates) => void update({ automaticUpdates })}
              description={t('preferences.automaticUpdatesDescription')}
            />
          </div>
        </>
      </CollapsibleSection>

      <CollapsibleSection
        title={t('preferences.sections.downloads')}
        expanded={settings.preferencesSectionsExpanded.downloads}
        onExpandedChange={(expanded) => updateSectionExpanded('downloads', expanded)}
      >
        <>
          <div className="p-4">
            <Switch
              label={t('preferences.alwaysAsk')}
              checked={settings.alwaysAskDownloadLocation}
              onChange={(alwaysAskDownloadLocation) => void update({ alwaysAskDownloadLocation })}
            />
          </div>
          <div className="p-4">
            <Switch
              label={t('preferences.createFolderPerDownload')}
              checked={settings.createFolderPerDownload}
              onChange={(createFolderPerDownload) => void update({ createFolderPerDownload })}
              description={t('preferences.createFolderPerDownloadDescription')}
            />
          </div>
          {!settings.alwaysAskDownloadLocation ? (
            <LocationSelector
              mode="directory"
              className="p-4"
              label={t('preferences.downloadLocation')}
              labelClassName="text-base"
              value={settings.defaultDownloadLocation}
              placeholder={t('preferences.downloadLocation')}
              chooseLabel={t('actions.choose')}
              onChoose={() => void chooseDownloadDirectory()}
              onOpen={() =>
                void window.cosmo.shell.openPath({ path: settings.defaultDownloadLocation })
              }
            />
          ) : null}
        </>
      </CollapsibleSection>

      <CollapsibleSection
        title={t('preferences.sections.metadata')}
        expanded={settings.preferencesSectionsExpanded.metadata}
        onExpandedChange={(expanded) => updateSectionExpanded('metadata', expanded)}
      >
        <>
          <div className="p-4">
            <Switch
              label={t('preferences.clipboardPrefetch')}
              checked={settings.clipboardPrefetchEnabled}
              onChange={(clipboardPrefetchEnabled) => void update({ clipboardPrefetchEnabled })}
              description={t('preferences.clipboardPrefetchDescription')}
            />
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-1">
                <span className="text-white/50 whitespace-nowrap">
                  {t('preferences.historyLimit')}
                </span>
                <Tooltip label={t('preferences.historyLimitDescription')}>
                  <Icon name="info" className="opacity-50" />
                </Tooltip>
              </span>
              <div className="flex">
                <NumberField
                  min={1}
                  max={5000}
                  step={1}
                  value={historyLimitInput ?? String(settings.historyLimitItems)}
                  suffix="items"
                  onFocus={() => {
                    if (historyLimitInput == null) {
                      setHistoryLimitInput(String(settings.historyLimitItems));
                    }
                  }}
                  onChange={(event) => setHistoryLimitInput(event.target.value)}
                  onCommit={commitHistoryLimitInput}
                />
              </div>
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-white/50">{t('preferences.cacheLimit')}</span>
                <p className="min-w-0 text-sm text-white/25">
                  {t('preferences.cacheCurrent')}{' '}
                  {cacheSummary == null
                    ? t('preferences.loading')
                    : formatBytes(cacheSummary.sizeBytes)}
                </p>
              </div>
              <div className="flex gap-2">
                <NumberField
                  min={1}
                  max={500}
                  step={1}
                  value={cacheLimitInput ?? String(settings.cacheLimitMb)}
                  suffix="MB"
                  onFocus={() => {
                    if (cacheLimitInput == null) {
                      setCacheLimitInput(String(settings.cacheLimitMb));
                    }
                  }}
                  onChange={(event) => setCacheLimitInput(event.target.value)}
                  onCommit={commitCacheLimitInput}
                />
                <Button
                  variant="secondary"
                  icon="trash"
                  label={t('preferences.clearCache')}
                  size="sm"
                  disabled={cacheSummary == null || !cacheSummary.hasClearableEntries}
                  onClick={() => void clearCache()}
                  ripple
                />
              </div>
            </div>
          </div>
        </>
      </CollapsibleSection>
    </section>
  );
}
