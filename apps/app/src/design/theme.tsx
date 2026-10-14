import {
  hitTarget,
  motion,
  radius,
  spacing,
  textStyles,
  themes,
  type ColorTokens,
  type FontWeight,
  type TextVariant,
} from '@shupit/tokens';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { Platform, useColorScheme, type TextStyle } from 'react-native';
import { useAppLanguage } from '@/i18n';
import { useThemeStore } from './themeStore';

const fontFamilies = {
  en: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  he: {
    regular: 'Heebo_400Regular',
    medium: 'Heebo_500Medium',
    semibold: 'Heebo_600SemiBold',
    bold: 'Heebo_700Bold',
  },
} as const satisfies Record<'en' | 'he', Record<FontWeight, string>>;

export interface Theme {
  mode: 'light' | 'dark';
  /** True when the UI language is right-to-left (Hebrew). */
  isRTL: boolean;
  /** Text alignment toward the end edge of a row (right in LTR, left in RTL). */
  endAlign: 'left' | 'right';
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  motion: typeof motion;
  hitTarget: number;
  textStyle: (variant: TextVariant) => TextStyle;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const preference = useThemeStore((s) => s.preference);
  const { language, isRTL } = useAppLanguage();
  const mode = preference === 'system' ? (scheme === 'dark' ? 'dark' : 'light') : preference;

  // Web: keep the page behind the app and the browser chrome in the active theme.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const background = themes[mode].background;
    document.documentElement.style.colorScheme = mode;
    document.body.style.backgroundColor = background;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
  }, [mode]);

  const theme = useMemo<Theme>(
    () => ({
      mode,
      isRTL,
      endAlign: isRTL ? 'left' : 'right',
      colors: themes[mode],
      spacing,
      radius,
      motion,
      hitTarget,
      textStyle: (variant) => {
        const s = textStyles[variant];
        return {
          fontSize: s.fontSize,
          lineHeight: s.lineHeight,
          fontFamily: fontFamilies[language][s.weight],
        };
      },
    }),
    [mode, language, isRTL],
  );

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside ThemeProvider');
  return theme;
}

export const fontAssetNames = [
  ...Object.values(fontFamilies.en),
  ...Object.values(fontFamilies.he),
];
