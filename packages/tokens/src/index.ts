/**
 * SHUPIT design tokens. Source of truth: SHUPIT Brand Book (October 2026).
 * Derived tokens (marked "derived") are not in the brand book; they exist to
 * meet WCAG AA and are pending design sign-off.
 */

export const brand = {
  primary: '#00B8B0',
  deepTeal: '#008F89',
  softAqua: '#E7FAF8',
  ink: '#071625',
  slate: '#64748B',
  surface: '#F7F9FA',
} as const;

export interface ColorTokens {
  background: string;
  surface: string;
  surfaceRaised: string;
  text: string;
  textSecondary: string;
  border: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  /** Teal usable as text on `background` at AA contrast (derived). */
  accentText: string;
  /** Foreground on top of `accent` fills (Ink passes AA; white does not). */
  onAccent: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  success: string;
  overlay: string;
}

export const lightColors: ColorTokens = {
  background: '#FFFFFF',
  surface: brand.surface,
  surfaceRaised: '#FFFFFF',
  text: brand.ink,
  textSecondary: brand.slate,
  border: '#E6EAEE',
  accent: brand.primary,
  accentStrong: brand.deepTeal,
  accentSoft: brand.softAqua,
  accentText: '#007A75',
  onAccent: brand.ink,
  danger: '#D92D20',
  dangerSoft: '#FEF3F2',
  warning: '#B54708',
  success: '#067647',
  overlay: 'rgba(7, 22, 37, 0.48)',
};

export const darkColors: ColorTokens = {
  background: brand.ink,
  surface: '#0D2236',
  surfaceRaised: '#12293E',
  text: '#F7F9FA',
  textSecondary: '#94A3B8',
  border: '#1B3248',
  accent: brand.primary,
  accentStrong: '#2DD4CB',
  accentSoft: '#0B2F36',
  accentText: '#2DD4CB',
  onAccent: brand.ink,
  danger: '#F97066',
  dangerSoft: '#3A1512',
  warning: '#FDB022',
  success: '#47CD89',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

/** 8-point grid with a 4px half-step. */
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold';

export const textStyles = {
  display: { fontSize: 32, lineHeight: 40, weight: 'bold' },
  title: { fontSize: 24, lineHeight: 32, weight: 'bold' },
  headline: { fontSize: 18, lineHeight: 26, weight: 'semibold' },
  body: { fontSize: 16, lineHeight: 24, weight: 'regular' },
  bodyStrong: { fontSize: 16, lineHeight: 24, weight: 'semibold' },
  small: { fontSize: 14, lineHeight: 20, weight: 'regular' },
  label: { fontSize: 14, lineHeight: 20, weight: 'medium' },
  caption: { fontSize: 12, lineHeight: 16, weight: 'medium' },
} as const satisfies Record<
  string,
  { fontSize: number; lineHeight: number; weight: FontWeight }
>;

export type TextVariant = keyof typeof textStyles;

export const motion = {
  fast: 120,
  base: 200,
  slow: 320,
} as const;

/** Minimum interactive size (px), per platform accessibility guidance. */
export const hitTarget = 44;

export type ThemeMode = 'light' | 'dark';

export const themes: Record<ThemeMode, ColorTokens> = {
  light: lightColors,
  dark: darkColors,
};
