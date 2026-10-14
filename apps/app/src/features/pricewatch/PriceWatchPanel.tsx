import {
  alertableKinds,
  fromMinor,
  getMerchant,
  monitoringAvailability,
  parsePriceNumber,
  toMinor,
  type SavedProduct,
} from '@shupit/contracts';
import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { Chip } from '@/components/Chip';
import { PriceChart } from '@/components/PriceChart';
import { Button, LoadingState, Text, TextField, useTheme } from '@/design';
import { useAppLanguage, useTranslation } from '@/i18n';
import { formatDateTime, formatPrice, percentChange } from '@/lib/format';
import { useObservations, usePriceWatch, useSetPriceWatch } from './hooks';

const DROP_OPTIONS = [5, 10, 20];

export function PriceWatchPanel({ product }: { product: SavedProduct }) {
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const theme = useTheme();
  const { colors, spacing, radius } = theme;
  const merchant = getMerchant(product.merchantId);
  const availability = monitoringAvailability(merchant);

  const watch = usePriceWatch(product.id);
  const setWatch = useSetPriceWatch(product.id);
  const observations = useObservations(product.id);

  const [target, setTarget] = useState('');
  const [targetError, setTargetError] = useState<string | null>(null);

  useEffect(() => {
    const tp = watch.data?.targetPrice;
    setTarget(tp ? String(fromMinor(tp)) : '');
  }, [watch.data?.targetPrice]);

  const saved = product.savedPrice;
  const verified = (observations.data ?? []).filter((o) => alertableKinds.includes(o.kind));
  const latest = [...(observations.data ?? [])].sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];
  const latestVerified = [...verified].sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];
  const change = latestVerified && saved ? percentChange(saved, latestVerified.price) : null;
  const points = verified.map((o) => ({ t: Date.parse(o.observedAt), v: fromMinor(o.price) }));
  const currency = saved?.currency ?? latest?.price.currency ?? 'ILS';

  const saveTarget = () => {
    const n = target.trim() ? parsePriceNumber(target) : null;
    if (target.trim() && n === null) {
      setTargetError(t('wishlist.add.invalidPrice'));
      return;
    }
    setTargetError(null);
    setWatch.mutate({ targetPrice: n === null ? null : { amountMinor: toMinor(n, currency), currency } });
  };

  const row = (label: string, value: string) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
      <Text color="textSecondary">{label}</Text>
      <Text variant="bodyStrong" style={{ flexShrink: 1, textAlign: theme.endAlign }}>
        {value}
      </Text>
    </View>
  );

  return (
    <View style={{ gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="headline" accessibilityRole="header">
          {t('priceWatch.trackPrice')}
        </Text>
        <Switch
          accessibilityLabel={t('priceWatch.trackPrice')}
          value={!!watch.data?.enabled}
          disabled={setWatch.isPending || watch.isLoading}
          onValueChange={(enabled) => setWatch.mutate({ enabled })}
          trackColor={{ true: colors.accent, false: colors.border }}
        />
      </View>

      <Text color="textSecondary" variant="small">
        {t(`priceWatch.availability.${availability}`)}
      </Text>
      {availability === 'manual' ? (
        <Text color="textSecondary" variant="small">
          {t('priceWatch.manualNote')}
        </Text>
      ) : null}

      <View style={{ gap: spacing.xs }}>
        {row(t('priceWatch.originalSaved'), formatPrice(saved, language) ?? '—')}
        {row(
          t('priceWatch.lastVerifiedOnVisit'),
          latestVerified
            ? `${formatPrice(latestVerified.price, language) ?? '—'} · ${formatDateTime(latestVerified.observedAt, language) ?? ''}`
            : t('priceWatch.notVerifiedYet'),
        )}
        {change !== null ? row(t('priceWatch.change'), `${change > 0 ? '+' : ''}${change.toFixed(1)}%`) : null}
        {latest && !alertableKinds.includes(latest.kind) ? (
          <Text variant="caption" color="warning">
            {`${formatPrice(latest.price, language)} · ${t('priceWatch.unverifiedRead')}`}
          </Text>
        ) : null}
      </View>

      <View style={{ gap: spacing.sm }}>
        <TextField
          label={`${t('priceWatch.targetPrice')} (${currency})`}
          value={target}
          onChangeText={setTarget}
          keyboardType="decimal-pad"
          error={targetError ?? undefined}
        />
        <Text variant="caption" color="textSecondary">
          {t('priceWatch.targetHint')}
        </Text>
        <Button variant="secondary" label={t('common.save')} loading={setWatch.isPending} onPress={saveTarget} />

        <Text variant="label" color="textSecondary">
          {t('priceWatch.minDrop')}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
          {DROP_OPTIONS.map((p) => (
            <Chip
              key={p}
              label={`${p}%`}
              selected={(watch.data?.minDropPercent ?? 5) === p}
              onPress={() => setWatch.mutate({ minDropPercent: p })}
            />
          ))}
        </View>
        <Text variant="caption" color="textSecondary">
          {t('priceWatch.targetSaved')}
        </Text>
        {setWatch.isError ? <Text color="danger">{t('common.saveFailed')}</Text> : null}
      </View>

      <View style={{ gap: spacing.xs }}>
        <Text variant="label" color="textSecondary">
          {t('priceWatch.history')}
        </Text>
        {observations.isLoading ? (
          <LoadingState rows={1} />
        ) : (
          <PriceChart
            points={points}
            emptyLabel={t('priceWatch.historyEmpty')}
            minLabel={points.length ? String(Math.min(...points.map((p) => p.v))) : ''}
            maxLabel={points.length ? String(Math.max(...points.map((p) => p.v))) : ''}
          />
        )}
        <Text variant="caption" color="textSecondary">
          {t('priceWatch.verifyHint')}
        </Text>
      </View>
    </View>
  );
}
