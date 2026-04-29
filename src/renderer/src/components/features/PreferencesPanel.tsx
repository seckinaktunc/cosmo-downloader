import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { CookieBrowser, PreferencesSection } from '../../../../shared/types';
import { SUPPORTED_LOCALES, resolveSupportedLocale } from '../../i18n';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUpdateStore } from '../../stores/updateStore';
import type { IconName } from '../miscellaneous/Icon';
import { Button } from '../ui/Button';
import { CollapsibleSection } from '../ui/CollapsibleSection';
import { LocationSelector } from '../ui/LocationSelector';
import { SelectField } from '../ui/SelectField';
import { Switch } from '../ui/Switch';
import AppIcon from '../miscellaneous/AppIcon';

const COOKIE_BROWSER_ICONS: Record<CookieBrowser, IconName> = {
  none: 'none',
  chrome: 'logos:chrome',
  chromium: 'logos:chrome',
  edge: 'logos:microsoft-edge',
  firefox: 'logos:firefox',
  brave: 'logos:brave',
  opera: 'logos:opera',
  vivaldi: 'logos:vivaldi',
  safari: 'logos:safari',
  whale: 'browser'
};

function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
}

export function PreferencesPanel(): React.JSX.Element {
  const { t } = useTranslation();
  const settings = useSettingsStore((state) => state.settings);
  const environment = useSettingsStore((state) => state.environment);
  const cookieBrowsers = useSettingsStore((state) => state.cookieBrowsers);
  const restartRequired = useSettingsStore((state) => state.restartRequired);
  const prefetchCacheSummary = useSettingsStore((state) => state.prefetchCacheSummary);
  const update = useSettingsStore((state) => state.update);
  const refreshPrefetchCacheSummary = useSettingsStore(
    (state) => state.refreshPrefetchCacheSummary
  );
  const clearPrefetchCache = useSettingsStore((state) => state.clearPrefetchCache);
  const chooseDownloadDirectory = useSettingsStore((state) => state.chooseDownloadDirectory);
  const updateState = useUpdateStore((state) => state.state);
  const checkForUpdates = useUpdateStore((state) => state.checkNow);
  const downloadUpdate = useUpdateStore((state) => state.download);
  const installUpdate = useUpdateStore((state) => state.install);

  useEffect(() => {
    void refreshPrefetchCacheSummary();
    const timer = window.setInterval(() => {
      void refreshPrefetchCacheSummary();
    }, 1000);

    return () => window.clearInterval(timer);
  }, [refreshPrefetchCacheSummary]);

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
              <span className="text-sm text-white/50">
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
            {updateState.status === 'available' ? (
              <Button
                label={t('updates.download')}
                size="sm"
                className="rounded-none"
                onClick={() => void downloadUpdate()}
              />
            ) : null}
            {updateState.status === 'downloaded' ? (
              <Button
                label={t('updates.restartNow')}
                size="sm"
                className="rounded-none"
                onClick={() => void installUpdate()}
              />
            ) : null}
            <Button
              label={t('updates.checkNow')}
              size="sm"
              className="rounded-none"
              disabled={updateState.status === 'checking' || updateState.status === 'downloading'}
              onClick={() => void checkForUpdates()}
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
              <div>
                <span className="text-white/50">{t('preferences.prefetchCache')}</span>
                <p className="min-w-0 text-sm text-white/25">
                  {prefetchCacheSummary == null
                    ? t('preferences.loading')
                    : prefetchCacheSummary.entryCount === 0
                      ? t('preferences.prefetchCacheEmpty')
                      : t('preferences.prefetchCacheSummary', {
                          count: prefetchCacheSummary.entryCount,
                          inflight: prefetchCacheSummary.inflightCount,
                          size: formatBytes(prefetchCacheSummary.sizeBytes)
                        })}
                </p>
              </div>
              <Button
                label={t('preferences.clearPrefetchCache')}
                size="sm"
                className="rounded-none"
                disabled={prefetchCacheSummary == null || prefetchCacheSummary.entryCount === 0}
                onClick={() => void clearPrefetchCache()}
              />
            </div>
          </div>
        </>
      </CollapsibleSection>
    </section>
  );
}
