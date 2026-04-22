import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import enUS from './en_US.json'
import trTR from './tr_TR.json'
import zhCN from './zh_CN.json'

export const DEFAULT_LOCALE = 'en_US'

export const SUPPORTED_LOCALES = [
  { value: 'en_US', label: 'English (US)', icon: 'flag:us-4x3' },
  { value: 'tr_TR', label: 'Türkçe', icon: 'flag:tr-4x3' },
  { value: 'zh_CN', label: '简体中文', icon: 'flag:cn-4x3' }
] as const

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]['value']

const supportedLocaleValues = new Set<string>(SUPPORTED_LOCALES.map((locale) => locale.value))

export function resolveSupportedLocale(value: string): SupportedLocale {
  return supportedLocaleValues.has(value) ? (value as SupportedLocale) : DEFAULT_LOCALE
}

export async function changeInterfaceLanguage(value: string): Promise<void> {
  await i18next.changeLanguage(resolveSupportedLocale(value))
}

void i18next.use(initReactI18next).init({
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  resources: {
    en_US: {
      translation: enUS
    },
    tr_TR: {
      translation: trTR
    },
    zh_CN: {
      translation: zhCN
    }
  },
  interpolation: {
    escapeValue: false
  }
})

export default i18next
