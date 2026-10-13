import { useEffect } from 'react';
import { I18nManager, Platform } from 'react-native';
import { i18n, useAppLanguage } from './index';

/**
 * Keeps i18next, document direction (web) and I18nManager (native) in sync with
 * the stored language preference. Native direction changes need an app restart.
 */
export function useApplyLanguage() {
  const { language, isRTL } = useAppLanguage();

  useEffect(() => {
    void i18n.changeLanguage(language);

    if (Platform.OS === 'web') {
      if (typeof document !== 'undefined') {
        document.documentElement.lang = language;
        document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
      }
      return;
    }

    I18nManager.allowRTL(true);
    if (I18nManager.isRTL !== isRTL) {
      I18nManager.forceRTL(isRTL);
    }
  }, [language, isRTL]);

  /** True on native when the saved direction differs from the running one. */
  const needsRestart = Platform.OS !== 'web' && I18nManager.isRTL !== isRTL;
  return { language, isRTL, needsRestart };
}
