import { useTranslation } from 'react-i18next'
import type { CookieBrowser } from '../../../../shared/types'
import type { IconName } from '../miscellaneous/Icon'
import { SelectField } from '../ui/SelectField'
import { Switch } from '../ui/Switch'
import { useSettingsStore } from '../../stores/settingsStore'

const COOKIE_BROWSER_ICONS: Record<CookieBrowser, IconName> = {
  none: 'browser',
  chrome: 'brandChrome',
  chromium: 'brandChrome',
  edge: 'brandEdge',
  firefox: 'brandFirefox',
  brave: 'browser',
  opera: 'brandOpera',
  vivaldi: 'brandVivaldi',
  safari: 'brandSafari'
}

export function SettingsPanel(): React.JSX.Element {
  const { t } = useTranslation()
  const settings = useSettingsStore((state) => state.settings)
  const cookieBrowsers = useSettingsStore((state) => state.cookieBrowsers)
  const restartRequired = useSettingsStore((state) => state.restartRequired)
  const update = useSettingsStore((state) => state.update)
  const chooseDownloadDirectory = useSettingsStore((state) => state.chooseDownloadDirectory)

  if (!settings) {
    return <div className="text-white/60">Loading settings...</div>
  }

  return (
    <section className="grid gap-4">
      <div>
        <h2 className="text-xl font-bold text-white">{t('settings.title')}</h2>
        {restartRequired ? (
          <p className="text-sm text-primary">{t('settings.restartRequired')}</p>
        ) : null}
      </div>

      <Switch
        label={t('settings.hardwareAcceleration')}
        checked={settings.hardwareAcceleration}
        onChange={(hardwareAcceleration) => void update({ hardwareAcceleration })}
      />
      <Switch
        label={t('settings.automaticUpdates')}
        checked={settings.automaticUpdates}
        onChange={(automaticUpdates) => void update({ automaticUpdates })}
      />
      <SelectField<CookieBrowser>
        label={t('settings.cookiesBrowser')}
        value={settings.cookiesBrowser}
        options={cookieBrowsers.map((browser) => ({
          value: browser.id,
          label: browser.label,
          icon: COOKIE_BROWSER_ICONS[browser.id]
        }))}
        onChange={(cookiesBrowser) => void update({ cookiesBrowser })}
      />
      <Switch
        label={t('settings.alwaysAsk')}
        checked={settings.alwaysAskDownloadLocation}
        onChange={(alwaysAskDownloadLocation) => void update({ alwaysAskDownloadLocation })}
      />

      {!settings.alwaysAskDownloadLocation ? (
        <div className="rounded-lg bg-white/5 px-4 py-3 text-white">
          <div className="mb-2 text-sm font-medium text-white/60">
            {t('settings.downloadLocation')}
          </div>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 truncate rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white/70">
              {settings.defaultDownloadLocation}
            </div>
            <button
              type="button"
              className="no-drag rounded-lg bg-white px-3 py-2 text-sm font-bold text-black outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              onClick={() => void chooseDownloadDirectory()}
            >
              {t('actions.choose')}
            </button>
          </div>
        </div>
      ) : null}

      <SelectField
        label={t('settings.language')}
        value={settings.interfaceLanguage}
        options={[{ value: 'en_US', label: 'English (US)', icon: 'language' }]}
        onChange={(interfaceLanguage) => void update({ interfaceLanguage })}
      />
    </section>
  )
}
