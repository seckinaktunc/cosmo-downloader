import { useTranslation } from 'react-i18next'
import type { CookieBrowser } from '../../../../shared/types'
import type { IconName } from '../miscellaneous/Icon'
import { SelectField } from '../ui/SelectField'
import { Switch } from '../ui/Switch'
import { useSettingsStore } from '../../stores/settingsStore'
import { LocationSelector } from '../ui/LocationSelector'

const COOKIE_BROWSER_ICONS: Record<CookieBrowser, IconName> = {
  none: 'none',
  chrome: 'logos:chrome',
  chromium: 'logos:chrome',
  edge: 'logos:microsoft-edge',
  firefox: 'logos:firefox',
  brave: 'logos:brave',
  opera: 'logos:opera',
  vivaldi: 'logos:vivaldi',
  safari: 'logos:safari'
}

export function SettingsPanel(): React.JSX.Element {
  const { t } = useTranslation()
  const settings = useSettingsStore((state) => state.settings)
  const cookieBrowsers = useSettingsStore((state) => state.cookieBrowsers)
  const restartRequired = useSettingsStore((state) => state.restartRequired)
  const update = useSettingsStore((state) => state.update)
  const chooseDownloadDirectory = useSettingsStore((state) => state.chooseDownloadDirectory)

  if (!settings) {
    return <div className="text-white/60">{t('settings.loading')}</div>
  }

  return (
    <section className="grid divide-y divide-white/10 border-b border-white/10">
      <div className="p-4">
        <SelectField
          label={t('settings.language')}
          value={settings.interfaceLanguage}
          options={[{ value: 'en_US', label: t('settings.englishUs'), icon: 'language' }]}
          onChange={(interfaceLanguage) => void update({ interfaceLanguage })}
        />
      </div>
      <div className="p-4">
        <Switch
          label={t('settings.hardwareAcceleration')}
          checked={settings.hardwareAcceleration}
          onChange={(hardwareAcceleration) => void update({ hardwareAcceleration })}
          description={t('settings.hardwareAccelerationDescription')}
          error={restartRequired ? t('settings.restartRequired') : undefined}
        />
      </div>
      <div className="p-4">
        <Switch
          label={t('settings.automaticUpdates')}
          checked={settings.automaticUpdates}
          onChange={(automaticUpdates) => void update({ automaticUpdates })}
        />
      </div>
      <div className="p-4">
        <SelectField<CookieBrowser>
          label={t('settings.cookiesBrowser')}
          value={settings.cookiesBrowser}
          options={cookieBrowsers.map((browser) => ({
            value: browser.id,
            label: browser.label,
            icon: COOKIE_BROWSER_ICONS[browser.id]
          }))}
          onChange={(cookiesBrowser) => void update({ cookiesBrowser })}
          description={t('settings.cookiesBrowserDescription')}
        />
      </div>
      <div className="p-4">
        <Switch
          label={t('settings.alwaysAsk')}
          checked={settings.alwaysAskDownloadLocation}
          onChange={(alwaysAskDownloadLocation) => void update({ alwaysAskDownloadLocation })}
        />
      </div>
      <div className="p-4">
        <Switch
          label={t('settings.createFolderPerDownload')}
          checked={settings.createFolderPerDownload}
          onChange={(createFolderPerDownload) => void update({ createFolderPerDownload })}
          description={t('settings.createFolderPerDownloadDescription')}
        />
      </div>

      {!settings.alwaysAskDownloadLocation ? (
        <LocationSelector
          mode="directory"
          className="p-4"
          label={t('settings.downloadLocation')}
          value={settings.defaultDownloadLocation}
          placeholder={t('settings.downloadLocation')}
          chooseLabel={t('actions.choose')}
          onChoose={() => void chooseDownloadDirectory()}
          onOpen={() =>
            void window.cosmo.shell.openPath({ path: settings.defaultDownloadLocation })
          }
        />
      ) : null}
    </section>
  )
}
