import { View } from 'react-native';
import { Button, Text, useTheme } from '@/design';
import { useTranslation } from '@/i18n';

export function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
        gap: spacing.md,
      }}
    >
      <Text variant="title" style={{ textAlign: 'center' }} accessibilityRole="header">
        {t('common.somethingWrong')}
      </Text>
      <Text color="textSecondary" style={{ textAlign: 'center', maxWidth: 360 }}>
        {t('common.crashBody')}
      </Text>
      <Button label={t('common.reload')} onPress={onRetry} />
    </View>
  );
}
