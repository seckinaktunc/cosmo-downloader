import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import enUS from './en_US.json'

void i18next.use(initReactI18next).init({
  lng: 'en_US',
  fallbackLng: 'en_US',
  resources: {
    en_US: {
      translation: enUS
    }
  },
  interpolation: {
    escapeValue: false
  }
})

export default i18next
