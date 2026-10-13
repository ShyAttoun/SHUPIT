import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import { en } from './locales/en';
import { he } from './locales/he';
import { useLanguageStore, type LanguagePreference } from './store';

export type AppLanguage = 'he' | 'en';

export function deviceLanguage(): AppLanguage {
  const code = getLocales()[0]?.languageCode;
  return code === 'he' || code === 'iw' ? 'he' : 'en';
}

export function resolveLanguage(preference: LanguagePreference): AppLanguage {
  return preference === 'system' ? deviceLanguage() : preference;
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, he: { translation: he } },
  lng: resolveLanguage(useLanguageStore.getState().preference),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

/** Current UI language, reactive to the stored preference. */
export function useAppLanguage(): { language: AppLanguage; isRTL: boolean } {
  const preference = useLanguageStore((s) => s.preference);
  const language = resolveLanguage(preference);
  return { language, isRTL: language === 'he' };
}

export { i18n, useTranslation };
