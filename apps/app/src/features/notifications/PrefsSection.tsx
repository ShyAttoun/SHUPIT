import type { NotificationPrefs } from '@shupit/contracts';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useAppLanguage } from '@/i18n';
import { disablePush, enablePush, hasLocalSubscription, permissionState, pushSupport } from '@/lib/webpush';
import { Text, useTheme, Toggle } from '@/design';
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
  const { language } = useAppLanguage();
  const support = pushSupport();
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);

  useEffect(() => {
    void hasLocalSubscription().then(setPushOn);
  }, []);

  const togglePush = async (next: boolean) => {
    setPushBusy(true);
    setPushMsg(null);
    try {
      if (next) {
        const r = await enablePush(language === 'he' ? 'he' : 'en');
        if (r === 'enabled') {
          setPushOn(true);
          set.mutate({ push: true });
        } else {
          setPushMsg(r === 'denied' ? t('notifications.prefs.pushDenied') : t('notifications.prefs.pushFailed'));
        }
      } else {
        await disablePush();
        setPushOn(false);
        set.mutate({ push: false });
      }
    } finally {
      setPushBusy(false);
    }
  };

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
          <Toggle
            accessibilityLabel={t(r.label)}
            value={prefs.data?.[r.key] ?? true}
            disabled={prefs.isLoading || set.isPending}
            onValueChange={(v) => set.mutate({ [r.key]: v })}
            trackColor={{ true: colors.accent, false: colors.border }}
          />
        </View>
      ))}

      {support !== 'not_configured' && support !== 'unsupported' ? (
        <View style={{ gap: spacing.xs, paddingTop: spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{t('notifications.prefs.pushTitle')}</Text>
              <Text variant="small" color="textSecondary">
                {support === 'needs_install'
                  ? t('notifications.prefs.pushNeedsInstall')
                  : pushOn
                    ? t('notifications.prefs.pushOn')
                    : t('notifications.prefs.pushBody')}
              </Text>
            </View>
            <Toggle
              accessibilityLabel={t('notifications.prefs.pushTitle')}
              value={pushOn}
              disabled={pushBusy || support !== 'supported' || permissionState() === 'denied'}
              onValueChange={(v) => void togglePush(v)}
              trackColor={{ true: colors.accent, false: colors.border }}
            />
          </View>
          {permissionState() === 'denied' ? (
            <Text variant="small" color="warning">
              {t('notifications.prefs.pushDenied')}
            </Text>
          ) : null}
          {pushMsg ? (
            <Text variant="small" color="danger" accessibilityLiveRegion="polite">
              {pushMsg}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
