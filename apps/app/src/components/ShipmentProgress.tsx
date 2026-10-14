import type { ShipmentStatus } from '@shupit/contracts';
import { View } from 'react-native';
import { Text, useTheme } from '@/design';
import { useTranslation } from '@/i18n';

/** Stage reached for each status. Only the stage is shown — never an invented percentage or position. */
const STAGE: Partial<Record<ShipmentStatus, number>> = {
  processing: 0,
  shipped: 1,
  in_transit: 1,
  customs: 1,
  out_for_delivery: 2,
  ready_for_pickup: 2,
  delivered: 3,
};

const KEYS = ['processing', 'in_transit', 'out_for_delivery', 'delivered'] as const;

export function ShipmentProgress({ status, labels = false }: { status: ShipmentStatus; labels?: boolean }) {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const stage = STAGE[status];
  if (stage === undefined) return null; // exception / returned / unknown: no progress to draw
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 3, now: stage }} style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {KEYS.map((k, i) => (
          <View
            key={k}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              backgroundColor: i <= stage ? colors.accent : colors.border,
            }}
          />
        ))}
      </View>
      {labels ? (
        <View style={{ flexDirection: 'row', gap: spacing.xxs }}>
          {KEYS.map((k, i) => (
            <Text
              key={k}
              variant="caption"
              color={i <= stage ? 'accentText' : 'textSecondary'}
              style={{ flex: 1 }}
              numberOfLines={1}
            >
              {t(`orders.status.${k}`)}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}
