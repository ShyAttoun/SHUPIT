import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { useTranslation } from '@/i18n';
import { useTheme } from './theme';

/**
 * Header back control that never dead-ends: goes back when there is history, otherwise to Home
 * (deep links, notifications and shares open inner screens with nothing beneath them).
 */
export function HeaderBack() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, hitTarget, isRTL } = useTheme();
  const Icon = isRTL ? ChevronRight : ChevronLeft;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      style={{ width: hitTarget, height: hitTarget, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon size={26} color={colors.text} />
    </Pressable>
  );
}
