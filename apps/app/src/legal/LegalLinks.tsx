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
        flexDirection: 'row',
        flexWrap: 'wrap',
        columnGap: spacing.md,
        rowGap: spacing.xxs,
        alignItems: 'center',
        justifyContent: center ? 'center' : 'flex-start',
      }}
    >
      {items.map(([id, label]) => (
        <Text
          key={id}
          variant="caption"
          color="accentText"
          accessibilityRole="link"
          onPress={() => router.push(`/legal/${id}`)}
        >
          {label}
        </Text>
      ))}
    </View>
  );
}
