import type { ShipmentStatus } from '@shupit/contracts';
import { View } from 'react-native';
import { Text, useTheme } from '@/design';
import { useTranslation } from '@/i18n';

export function StatusBadge({ status }: { status: ShipmentStatus }) {
  const { colors, radius, spacing } = useTheme();
  const { t } = useTranslation();
  const tone =
    status === 'delivered'
      ? { bg: colors.accentSoft, fg: 'success' as const }
      : status === 'exception' || status === 'returned'
        ? { bg: colors.dangerSoft, fg: 'danger' as const }
        : status === 'unknown'
          ? { bg: colors.surface, fg: 'textSecondary' as const }
          : { bg: colors.accentSoft, fg: 'accentText' as const };
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: spacing.xs + 2,
        paddingVertical: 2,
        borderRadius: radius.full,
        backgroundColor: tone.bg,
        borderWidth: status === 'unknown' ? 1 : 0,
        borderColor: colors.border,
      }}
    >
      <Text variant="caption" color={tone.fg}>
        {t(`orders.status.${status}`)}
      </Text>
    </View>
  );
}
