import { Moon, Sun } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { useTranslation } from '@/i18n';
import { useTheme } from './theme';
import { useThemeStore } from './themeStore';

/** Header button that switches between the light and dark theme. */
export function ThemeToggle() {
  const { mode, colors, hitTarget } = useTheme();
  const setPreference = useThemeStore((s) => s.setPreference);
  const { t } = useTranslation();
  const next = mode === 'dark' ? 'light' : 'dark';
  const Icon = mode === 'dark' ? Sun : Moon;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={next === 'light' ? t('header.lightTheme') : t('header.darkTheme')}
      onPress={() => setPreference(next)}
      style={{ width: hitTarget, height: hitTarget, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon size={24} color={colors.text} />
    </Pressable>
  );
}
