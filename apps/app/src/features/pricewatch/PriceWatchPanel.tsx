import { fromMinor, getMerchant, monitoringAvailability, parsePriceNumber, toMinor, type SavedProduct } from '@shupit/contracts';
import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { PriceChart } from '@/components/PriceChart';
import { Button, LoadingState, Text, TextField, useTheme } from '@/design';
import { useAppLanguage, useTranslation } from '@/i18n';
import { formatDateTime, formatPrice, percentChange } from '@/lib/format';
import { usePriceHistory, usePriceWatch, useSetPriceWatch } from './hooks';

export function PriceWatchPanel({ product }: { product: SavedProduct }) {
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const { colors, spacing, radius } = useTheme();
  const merchant = getMerchant(product.merchantId);
  const availability = monitoringAvailability(merchant);
  const available = availability === 'active';

  const watch = usePriceWatch(product.id);
  const setWatch = useSetPriceWatch(product.id);
  const history = usePriceHistory(product.id, available);

  const [target, setTarget] = useState('');
  const [targetError, setTargetError] = useState<string | null>(null);

  useEffect(() => {
    const tp = watch.data?.targetPrice;
    setTarget(tp ? String(fromMinor(tp)) : '');
  }, [watch.data?.targetPrice]);

  const points = (history.data ?? [])
    .filter((p) => p.kind === 'live' || p.kind === 'feed')
    .map((p) => ({ t: Date.parse(p.observedAt), v: fromMinor(p.price) }));
  const verified = [...(history.data ?? [])]
    .filter((p) => p.kind === 'live' || p.kind === 'feed')
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];

  const saved = product.savedPrice;
  const change = verified && saved ? percentChange(saved, verified.price) : null;

  const saveTarget = () => {
    const n = target.trim() ? parsePriceNumber(target) : null;
    if (target.trim() && n === null) {
      setTargetError(t('wishlist.add.invalidPrice'));
      return;
    }
    setTargetError(null);
    const currency = saved?.currency ?? 'ILS';
    setWatch.mutate({
      enabled: watch.data?.enabled ?? false,
      targetPrice: n === null ? null : { amountMinor: toMinor(n, currency), currency },
    });
  };

  const row = (label: string, value: string) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
      <Text color="textSecondary">{label}</Text>
      <Text variant="bodyStrong" style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );

  return (
    <View
      style={{
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="headline" accessibilityRole="header">
          {t('priceWatch.trackPrice')}
        </Text>
        <Switch
          accessibilityLabel={t('priceWatch.trackPrice')}
          value={!!watch.data?.enabled && available}
          disabled={!available || setWatch.isPending || watch.isLoading}
          onValueChange={(enabled) => setWatch.mutate({ enabled })}
          trackColor={{ true: colors.accent, false: colors.border }}
        />
      </View>

      <Text color="textSecondary" variant="small">
        {t(`priceWatch.availability.${availability}`)}
      </Text>

      <View style={{ gap: spacing.xs }}>
        {row(t('priceWatch.originalSaved'), formatPrice(saved, language) ?? '—')}
        {row(
          t('priceWatch.currentVerified'),
          verified ? (formatPrice(verified.price, language) ?? '—') : t('priceWatch.noVerified'),
        )}
        {change !== null ? row(t('priceWatch.change'), `${change > 0 ? '+' : ''}${change.toFixed(1)}%`) : null}
        {row(
          t('priceWatch.lastChecked'),
          verified ? (formatDateTime(verified.observedAt, language) ?? '—') : t('common.never'),
        )}
      </View>

      {available ? (
        <View style={{ gap: spacing.sm }}>
          <TextField
            label={`${t('priceWatch.targetPrice')} (${saved?.currency ?? 'ILS'})`}
            value={target}
            onChangeText={setTarget}
            keyboardType="decimal-pad"
            error={targetError ?? undefined}
          />
          <Text variant="caption" color="textSecondary">
            {t('priceWatch.targetHint')}
          </Text>
          <Button
            variant="secondary"
            label={t('common.save')}
            loading={setWatch.isPending}
            onPress={saveTarget}
          />
          {setWatch.isError ? <Text color="danger">{t('common.saveFailed')}</Text> : null}
        </View>
      ) : null}

      <View style={{ gap: spacing.xs }}>
        <Text variant="label" color="textSecondary">
          {t('priceWatch.history')}
        </Text>
        {history.isLoading && available ? (
          <LoadingState rows={1} />
        ) : (
          <PriceChart
            points={points}
            emptyLabel={t('priceWatch.historyEmpty')}
            minLabel={points.length ? String(Math.min(...points.map((p) => p.v))) : ''}
            maxLabel={points.length ? String(Math.max(...points.map((p) => p.v))) : ''}
          />
        )}
      </View>
    </View>
  );
}
