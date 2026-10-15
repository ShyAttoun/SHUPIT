import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { Button, Text, useTheme, useToast } from '@/design';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAppLanguage, useTranslation } from '@/i18n';
import { apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/format';

const ENDPOINT = 'https://app.shupit.co.il/api/sms-hook';

/** Creates / revokes the personal key used by phone automations that forward delivery SMS. */
export function SmsAutomationSection() {
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const { spacing, colors, radius } = useTheme();
  const toast = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [fresh, setFresh] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ['automationKey', user?.uid],
    enabled: !!user,
    queryFn: () => apiFetch<{ exists: boolean; createdAt: string | null; lastUsedAt: string | null }>('/api/automation-key'),
  });
  const create = useMutation({
    mutationFn: () => apiFetch<{ key: string }>('/api/automation-key', { method: 'POST' }),
    onSuccess: async (r) => {
      setFresh(r.key);
      await qc.invalidateQueries({ queryKey: ['automationKey', user?.uid] });
    },
  });
  const revoke = useMutation({
    mutationFn: () => apiFetch('/api/automation-key', { method: 'DELETE' }),
    onSuccess: async () => {
      setFresh(null);
      await qc.invalidateQueries({ queryKey: ['automationKey', user?.uid] });
    },
  });

  const s = status.data;
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="label" color="textSecondary">
        {t('settings.automation.title')}
      </Text>
      <Text variant="small" color="textSecondary">
        {t('settings.automation.body')}
      </Text>

      {fresh ? (
        <View
          style={{
            gap: spacing.xs,
            padding: spacing.sm,
            borderRadius: radius.lg,
            backgroundColor: colors.accentSoft,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text variant="small">{t('settings.automation.keyOnce')}</Text>
          <Text variant="bodyStrong" selectable style={{ fontFamily: Platform.OS === 'web' ? 'monospace' : undefined }}>
            {fresh}
          </Text>
          <Button
            variant="secondary"
            label={t('orders.detail.copy')}
            onPress={() => {
              void navigator.clipboard?.writeText(fresh).then(() => toast.show(t('orders.detail.copied')));
            }}
          />
          <Text variant="caption">{t('settings.automation.endpoint', { url: ENDPOINT })}</Text>
        </View>
      ) : s?.exists ? (
        <Text variant="small">
          {t('settings.automation.created', { date: formatDate(s.createdAt, language) ?? '' })} ·{' '}
          {s.lastUsedAt
            ? t('settings.automation.lastUsed', { date: formatDate(s.lastUsedAt, language) ?? '' })
            : t('settings.automation.never')}
        </Text>
      ) : (
        <Text variant="small" color="textSecondary">
          {t('settings.automation.none')}
        </Text>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        <Button
          variant="secondary"
          label={s?.exists ? t('settings.automation.replace') : t('settings.automation.create')}
          loading={create.isPending}
          onPress={() => create.mutate()}
        />
        {s?.exists ? (
          <Button
            variant="ghost"
            label={t('settings.automation.revoke')}
            loading={revoke.isPending}
            onPress={() => revoke.mutate()}
          />
        ) : null}
      </View>
    </View>
  );
}
