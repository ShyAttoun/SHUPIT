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
      // The direction only applies to a fresh start: reload the JS bundle once so the user does
      // not have to close the app by hand. (Release builds only; dev clients show the reload UI.)
      // Guarded so a platform that ignores forceRTL can never loop.
      void (async () => {
        try {
          const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
          const KEY = 'shupit.rtlReloadFor';
          if ((await AsyncStorage.getItem(KEY)) === String(isRTL)) return;
          await AsyncStorage.setItem(KEY, String(isRTL));
          await (await import('expo-updates')).reloadAsync();
        } catch {
          // dev client or no updates module: the direction applies on the next start
        }
      })();
    }
  }, [language, isRTL]);

  /** True on native when the saved direction differs from the running one. */
  const needsRestart = Platform.OS !== 'web' && I18nManager.isRTL !== isRTL;
  return { language, isRTL, needsRestart };
}
