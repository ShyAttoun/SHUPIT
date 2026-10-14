import { merchantCatalog } from '@shupit/contracts';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Chip } from '@/components/Chip';
import { Button, EmptyState, LoadingState, Screen, Text, TextField, useTheme } from '@/design';
import { useAppLanguage, useTranslation } from '@/i18n';
import { ApiError, apiFetch } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { useOrders } from './hooks';
import { diffOrderUpdate, valuesFromOrder, type OrderFormErrors, type OrderFormValues } from './orderForm';

export function EditOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const { spacing } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const orders = useOrders();
  const order = (orders.data ?? []).find((o) => o.id === id);
  const fallbackCurrency = language === 'he' ? 'ILS' : 'USD';

  const [values, setValues] = useState<OrderFormValues | null>(null);
  const [errors, setErrors] = useState<OrderFormErrors>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [duplicate, setDuplicate] = useState(false);

  useEffect(() => {
    if (order && !values) setValues(valuesFromOrder(order, fallbackCurrency));
  }, [order, values, fallbackCurrency]);

  if (orders.isLoading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (!order || !values) {
    return (
      <Screen>
        <EmptyState title={t('orders.detail.notFound')} />
      </Screen>
    );
  }

  const set = <K extends keyof OrderFormValues>(k: K, v: OrderFormValues[K]) =>
    setValues((s) => (s ? { ...s, [k]: v } : s));
  const errText = (key?: string) =>
    key === 'required'
      ? t('common.required')
      : key === 'invalidDate'
        ? t('orders.form.invalidDate')
        : key === 'invalidTotal'
          ? t('orders.form.invalidTotal')
          : key
            ? t('common.saveFailed')
            : undefined;

  const save = async () => {
    setFailed(false);
    setDuplicate(false);
    const r = diffOrderUpdate(order, values);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    setErrors({});
    if (!r.input) {
      router.replace(`/order/${order.id}`);
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/orders?id=${encodeURIComponent(order.id)}`, { method: 'PUT', body: r.input });
      await qc.invalidateQueries({ queryKey: ['orders', user?.uid] });
      router.replace(`/order/${order.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'duplicate') setDuplicate(true);
      else setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: t('edit.order.title') }} />
      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.xs }}>
          <Text variant="label" color="textSecondary">
            {t('orders.form.store')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {merchantCatalog.map((m) => (
              <Chip
                key={m.id}
                label={m.name}
                selected={values.merchantId === m.id}
                onPress={() => setValues((s) => (s ? { ...s, merchantId: m.id, merchantName: m.name } : s))}
              />
            ))}
            <Chip
              label={t('orders.form.storeOther')}
              selected={values.merchantId === null}
              onPress={() => set('merchantId', null)}
            />
          </View>
          <TextField
            label={t('orders.form.storeName')}
            value={values.merchantName}
            onChangeText={(v) => setValues((s) => (s ? { ...s, merchantName: v, merchantId: null } : s))}
            maxLength={120}
            error={errText(errors.merchantName)}
          />
        </View>

        <TextField
          label={`${t('orders.form.orderNumber')} (${t('common.optional')})`}
          value={values.orderNumber}
          onChangeText={(v) => set('orderNumber', v)}
          autoCapitalize="none"
          maxLength={80}
        />
        <TextField
          label={`${t('orders.form.purchaseDate')} (${t('orders.form.dateHint')})`}
          value={values.purchaseDate}
          onChangeText={(v) => set('purchaseDate', v)}
          placeholder={t('orders.form.dateHint')}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
          error={errText(errors.purchaseDate)}
        />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 2 }}>
            <TextField
              label={`${t('orders.form.total')} (${t('common.optional')})`}
              value={values.total}
              onChangeText={(v) => set('total', v)}
              keyboardType="decimal-pad"
              error={errText(errors.total)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              label={t('orders.form.currency')}
              value={values.currency}
              onChangeText={(v) => set('currency', v.toUpperCase().slice(0, 3))}
              autoCapitalize="characters"
              maxLength={3}
            />
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text variant="headline">{t('orders.form.items')}</Text>
          {values.items.map((it, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' }}>
              <View style={{ flex: 3 }}>
                <TextField
                  label={`${t('orders.form.itemTitle')} ${i + 1}`}
                  value={it.title}
                  onChangeText={(v) =>
                    set('items', values.items.map((x, j) => (j === i ? { ...x, title: v } : x)))
                  }
                  maxLength={200}
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  label={t('orders.form.quantity')}
                  value={it.quantity}
                  onChangeText={(v) =>
                    set('items', values.items.map((x, j) => (j === i ? { ...x, quantity: v.replace(/\D/g, '') } : x)))
                  }
                  keyboardType="number-pad"
                />
              </View>
              {values.items.length > 1 ? (
                <Button
                  variant="ghost"
                  label="✕"
                  accessibilityLabel={t('orders.form.removeItem')}
                  onPress={() => set('items', values.items.filter((_, j) => j !== i))}
                  style={{ paddingHorizontal: spacing.sm }}
                />
              ) : null}
            </View>
          ))}
          {errors.items ? <Text color="danger">{t('common.saveFailed')}</Text> : null}
          {values.items.length < 20 ? (
            <Button
              variant="secondary"
              label={t('orders.form.addItem')}
              onPress={() => set('items', [...values.items, { title: '', quantity: '1' }])}
            />
          ) : null}
        </View>

        {duplicate ? (
          <Text color="warning" accessibilityLiveRegion="polite">
            {t('edit.order.duplicate')}
          </Text>
        ) : null}
        {failed ? (
          <Text color="danger" accessibilityLiveRegion="polite">
            {t('common.saveFailed')}
          </Text>
        ) : null}
        <Button label={t('edit.order.saveChanges')} loading={busy} onPress={() => void save()} />
      </View>
    </Screen>
  );
}
