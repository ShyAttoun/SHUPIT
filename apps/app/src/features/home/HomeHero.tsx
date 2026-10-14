import { View } from 'react-native';
import { LogoMark, Text, useTheme } from '@/design';
import { useTranslation } from '@/i18n';

/** Greeting plus a one-line, data-backed summary. Numbers come from real shipments only. */
export function HomeHero({
  name,
  active,
  pickup,
}: {
  name?: string | null;
  active: number;
  pickup: number;
}) {
  const { t } = useTranslation();
  const { colors, spacing, radius, elevation } = useTheme();
  const summary =
    pickup > 0
      ? t('home.hero.pickup', { count: pickup })
      : active > 0
        ? t('home.hero.active', { count: active })
        : t('home.hero.calm');
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radius.xl,
        backgroundColor: colors.accentSoft,
        borderWidth: 1,
        borderColor: colors.border,
        ...elevation(2),
      }}
    >
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Text variant="title">{name ? t('home.hero.hello', { name }) : t('home.hero.helloAnon')}</Text>
        <Text color="textSecondary">{summary}</Text>
        <Text variant="caption" color="accentText">
          {t('home.hero.tagline')}
        </Text>
      </View>
      <LogoMark size={56} />
    </View>
  );
}
