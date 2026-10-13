import { merchantCatalog } from '@shupit/contracts';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Chip } from '@/components/Chip';
import { Button, Screen, Text, TextField, useTheme } from '@/design';
import { useFavoriteStores } from '@/features/stores/hooks';
import { useAppLanguage, useTranslation } from '@/i18n';
import { ApiError } from '@/lib/api';
import { useOrderMutations } from './hooks';
import { buildOrderInput, type OrderFormErrors, type OrderFormValues } from './orderForm';

export function AddOrderScreen() {
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const { spacing } = useTheme();
  const router = useRouter();
  const favorites = useFavoriteStores();
  const { createOrder } = useOrderMutations();

  const [values, setValues] = useState<OrderFormValues>({
    merchantId: null,
    merchantName: '',
    orderNumber: '',
    purchaseDate: '',
    total: '',
    currency: language === 'he' ? 'ILS' : 'USD',
    items: [{ title: '', quantity: '1' }],
    carrier: '',
    trackingNumber: '',
    eta: '',
  });
  const [errors, setErrors] = useState<OrderFormErrors>({});
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const set = <K extends keyof OrderFormValues>(k: K, v: OrderFormValues[K]) =>
    setValues((s) => ({ ...s, [k]: v }));

  const favoriteIds = (favorites.data ?? []).map((f) => f.merchantId);
  const ordered = [
    ...merchantCatalog.filter((m) => favoriteIds.includes(m.id)),
    ...merchantCatalog.filter((m) => !favoriteIds.includes(m.id)),
  ];

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

  const submit = async () => {
    setFailed(false);
    setDuplicateId(null);
    const r = buildOrderInput(values);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    setErrors({});
    try {
      const res = await createOrder.mutateAsync(r.input);
      router.replace(`/order/${res.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'duplicate') {
        setDuplicateId((e.body as { existingId?: string } | undefined)?.existingId ?? null);
      } else {
        setFailed(true);
      }
    }
  };

  return (
    <Screen scroll>
      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.xs }}>
          <Text variant="label" color="textSecondary">
            {t('orders.form.store')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {ordered.map((m) => (
              <Chip
                key={m.id}
                label={m.name}
                selected={values.merchantId === m.id}
                onPress={() => setValues((s) => ({ ...s, merchantId: m.id, merchantName: m.name }))}
              />
            ))}
            <Chip
              label={t('orders.form.storeOther')}
              selected={values.merchantId === null}
              onPress={() => setValues((s) => ({ ...s, merchantId: null, merchantName: '' }))}
            />
          </View>
          {values.merchantId === null ? (
            <TextField
              label={t('orders.form.storeName')}
              value={values.merchantName}
              onChangeText={(v) => set('merchantName', v)}
              maxLength={120}
              error={errText(errors.merchantName)}
            />
          ) : errors.merchantName ? (
            <Text color="danger">{t('common.required')}</Text>
          ) : null}
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

        <View style={{ gap: spacing.sm }}>
          <Text variant="headline">{t('orders.form.tracking')}</Text>
          <TextField
            label={`${t('orders.form.carrier')} (${t('common.optional')})`}
            value={values.carrier}
            onChangeText={(v) => set('carrier', v)}
            maxLength={60}
          />
          <TextField
            label={`${t('orders.form.trackingNumber')} (${t('common.optional')})`}
            value={values.trackingNumber}
            onChangeText={(v) => set('trackingNumber', v)}
            autoCapitalize="characters"
            maxLength={60}
          />
          <TextField
            label={`${t('orders.form.eta')} (${t('orders.form.dateHint')})`}
            value={values.eta}
            onChangeText={(v) => set('eta', v)}
            placeholder={t('orders.form.dateHint')}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            error={errText(errors.eta)}
          />
        </View>

        {duplicateId ? (
          <View style={{ gap: spacing.xs }}>
            <Text color="warning" accessibilityLiveRegion="polite">
              {t('orders.form.duplicate')}
            </Text>
            <Button
              variant="secondary"
              label={t('orders.form.viewExisting')}
              onPress={() => router.replace(`/order/${duplicateId}`)}
            />
          </View>
        ) : null}
        {failed ? (
          <Text color="danger" accessibilityLiveRegion="polite">
            {t('common.saveFailed')}
          </Text>
        ) : null}

        <Button label={t('orders.form.saveOrder')} loading={createOrder.isPending} onPress={() => void submit()} />
      </View>
    </Screen>
  );
}
