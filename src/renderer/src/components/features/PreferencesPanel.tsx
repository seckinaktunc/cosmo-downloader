import { useTranslation } from 'react-i18next'
import type { CookieBrowser } from '../../../../shared/types'
import type { IconName } from '../miscellaneous/Icon'
import { SelectField } from '../ui/SelectField'
import { Switch } from '../ui/Switch'
import { useSettingsStore } from '../../stores/settingsStore'
import { useUpdateStore } from '../../stores/updateStore'
import { LocationSelector } from '../ui/LocationSelector'
import { Button } from '../ui/Button'
import { SUPPORTED_LOCALES, resolveSupportedLocale } from '../../i18n'

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
}

export function PreferencesPanel(): React.JSX.Element {
  const { t } = useTranslation()
  const settings = useSettingsStore((state) => state.settings)
  const cookieBrowsers = useSettingsStore((state) => state.cookieBrowsers)
  const restartRequired = useSettingsStore((state) => state.restartRequired)
  const update = useSettingsStore((state) => state.update)
  const chooseDownloadDirectory = useSettingsStore((state) => state.chooseDownloadDirectory)
  const updateState = useUpdateStore((state) => state.state)
  const checkForUpdates = useUpdateStore((state) => state.checkNow)
  const downloadUpdate = useUpdateStore((state) => state.download)
  const installUpdate = useUpdateStore((state) => state.install)

  if (!settings) {
    return <div className="text-white/60">{t('preferences.loading')}</div>
  }

  return (
    <section className="grid divide-y divide-white/10 border-b border-white/10">
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
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-white/50">{t('updates.checkNow')}</span>
            <p className="min-w-0 text-sm text-white/25">
              {updateState.error ??
                updateState.unavailableReason ??
                t(`updates.status.${updateState.status}`, {
                  version: updateState.updateInfo?.version,
                  percent: Math.round(updateState.progress?.percent ?? 0)
                })}
            </p>
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
    </section>
  )
}
