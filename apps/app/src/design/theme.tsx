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
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme, type TextStyle } from 'react-native';
import { useAppLanguage } from '@/i18n';

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
  const { language } = useAppLanguage();
  const mode = scheme === 'dark' ? 'dark' : 'light';

  const theme = useMemo<Theme>(
    () => ({
      mode,
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
    [mode, language],
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
