import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import fr from './locales/fr/translation.json'
import mg from './locales/mg/translation.json'

localStorage.setItem('yfc-lang', 'fr')

i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, mg: { translation: mg } },
  lng: 'fr',
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
})

export default i18n
