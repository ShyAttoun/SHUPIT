import type { NotificationPrefs } from '@shupit/contracts';
import { Switch, View } from 'react-native';
import { Text, useTheme } from '@/design';
import { useTranslation } from '@/i18n';
import { useNotificationPrefs, useSetNotificationPref } from './hooks';

const ROWS: { key: Exclude<keyof NotificationPrefs, 'push'>; label: string }[] = [
  { key: 'priceDrops', label: 'notifications.prefs.priceDrops' },
  { key: 'targetReached', label: 'notifications.prefs.targetReached' },
  { key: 'shipmentStatus', label: 'notifications.prefs.shipmentStatus' },
  { key: 'readyForPickup', label: 'notifications.prefs.readyForPickup' },
  { key: 'deliveryExceptions', label: 'notifications.prefs.deliveryExceptions' },
];

export function NotificationPrefsSection() {
  const { t } = useTranslation();
  const { spacing, colors } = useTheme();
  const prefs = useNotificationPrefs();
  const set = useSetNotificationPref();

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="label" color="textSecondary">
        {t('notifications.prefs.title')}
      </Text>
      <Text variant="small" color="textSecondary">
        {t('notifications.prefs.body')}
      </Text>
      {ROWS.map((r) => (
        <View
          key={r.key}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}
        >
          <Text style={{ flex: 1 }}>{t(r.label)}</Text>
          <Switch
            accessibilityLabel={t(r.label)}
            value={prefs.data?.[r.key] ?? true}
            disabled={prefs.isLoading || set.isPending}
            onValueChange={(v) => set.mutate({ [r.key]: v })}
            trackColor={{ true: colors.accent, false: colors.border }}
          />
        </View>
      ))}
    </View>
  );
}
