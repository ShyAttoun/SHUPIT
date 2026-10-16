import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Text, useTheme } from '@/design';
import { useTranslation } from '@/i18n';

/** Footer links to the three legal documents. Works signed-out (public routes). */
export function LegalLinks({ center = false }: { center?: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { spacing } = useTheme();
  const items = [
    ['privacy', t('legal.privacy')],
    ['terms', t('legal.terms')],
    ['affiliate', t('legal.affiliate')],
  ] as const;
  return (
    <View
      style={{
        // All three links on ONE line; the text shrinks (down to 80%) instead of wrapping.
        flexDirection: 'row',
        flexWrap: 'nowrap',
        columnGap: spacing.sm,
        alignItems: 'center',
        justifyContent: center ? 'center' : 'space-between',
      }}
    >
      {items.map(([id, label]) => (
        <Text
          key={id}
          variant="caption"
          color="accentText"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={{ flexShrink: 1, fontSize: 12 }}
          accessibilityRole="link"
          onPress={() => router.push(`/legal/${id}`)}
        >
          {label}
        </Text>
      ))}
    </View>
  );
}
