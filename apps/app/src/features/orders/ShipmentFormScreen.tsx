import { shipmentStatus, type PickupInput, type ShipmentInput, type ShipmentStatus } from '@shupit/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Chip } from '@/components/Chip';
import { Button, LoadingState, Screen, Text, TextField, useTheme } from '@/design';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTranslation } from '@/i18n';
import { apiFetch } from '@/lib/api';
import { confirmAction } from '@/lib/platform';
import { useShipments } from './hooks';
import { dateToIso } from './orderForm';

interface Form {
  carrier: string;
  trackingNumber: string;
  etaFrom: string;
  etaTo: string;
  status: ShipmentStatus | null;
  statusText: string;
  pickupName: string;
  pickupAddress: string;
  pickupUntil: string;
  pickupInstructions: string;
  pickupCode: string;
}

const empty: Form = {
  carrier: '',
  trackingNumber: '',
  etaFrom: '',
  etaTo: '',
  status: null,
  statusText: '',
  pickupName: '',
  pickupAddress: '',
  pickupUntil: '',
  pickupInstructions: '',
  pickupCode: '',
};

/** Pure: form → API payload. `forEdit` sends nulls so cleared fields are really cleared. */
export function buildShipmentPayload(
  f: Form,
  forEdit: boolean,
): { ok: true; input: ShipmentInput } | { ok: false; errors: Partial<Record<'etaFrom' | 'etaTo' | 'pickupUntil', string>> } {
  const errors: Partial<Record<'etaFrom' | 'etaTo' | 'pickupUntil', string>> = {};
  const day = (v: string, key: 'etaFrom' | 'etaTo' | 'pickupUntil') => {
    if (!v.trim()) return null;
    const iso = dateToIso(v);
    if (!iso) errors[key] = 'invalidDate';
    return iso;
  };
  const etaFrom = day(f.etaFrom, 'etaFrom');
  const etaTo = day(f.etaTo, 'etaTo');
  const until = day(f.pickupUntil, 'pickupUntil');
  if (Object.keys(errors).length) return { ok: false, errors };

  const opt = (v: string) => (v.trim() ? v.trim() : forEdit ? null : undefined);
  const pickup: PickupInput = {
    ...(f.pickupName.trim() ? { name: f.pickupName.trim() } : {}),
    ...(f.pickupAddress.trim() ? { address: f.pickupAddress.trim() } : {}),
    ...(until ? { until } : {}),
    ...(f.pickupInstructions.trim() ? { instructions: f.pickupInstructions.trim() } : {}),
    ...(f.pickupCode.trim() ? { code: f.pickupCode.trim() } : {}),
  };
  const input: ShipmentInput = {
    carrier: opt(f.carrier),
    trackingNumber: opt(f.trackingNumber),
    estimatedDeliveryAt: etaTo ?? (forEdit ? null : undefined),
    estimatedDeliveryFrom: etaFrom ?? (forEdit ? null : undefined),
    statusText: opt(f.statusText),
    pickup: Object.keys(pickup).length ? pickup : forEdit ? null : undefined,
    ...(f.status ? { status: f.status } : {}),
  };
  return { ok: true, input: Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as ShipmentInput };
}

export function ShipmentFormScreen() {
  const { orderId, id, manual } = useLocalSearchParams<{ orderId: string; id?: string; manual?: string }>();
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const shipments = useShipments();
  const existing = id ? (shipments.data ?? []).find((s) => s.id === id) : undefined;

  const [f, setF] = useState<Form>(empty);
  const [loaded, setLoaded] = useState(!id);
  const [manualPickup, setManualPickup] = useState(manual === 'pickup');
  const [errors, setErrors] = useState<Partial<Record<'etaFrom' | 'etaTo' | 'pickupUntil', string>>>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (id && existing && !loaded) {
      const day = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');
      setF({
        carrier: existing.carrier ?? '',
        trackingNumber: existing.trackingNumber ?? '',
        etaFrom: day(existing.estimatedDeliveryFrom),
        etaTo: day(existing.estimatedDeliveryAt),
        status: null, // keep the current status unless the user picks another
        statusText: existing.statusText ?? '',
        pickupName: existing.pickup?.name ?? '',
        pickupAddress: existing.pickup?.address ?? '',
        pickupUntil: day(existing.pickup?.until),
        pickupInstructions: existing.pickup?.instructions ?? '',
        pickupCode: existing.pickup?.code ?? '',
      });
      setLoaded(true);
    }
  }, [id, existing, loaded]);

  if (id && !loaded) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));
  const dateErr = (k: 'etaFrom' | 'etaTo' | 'pickupUntil') => (errors[k] ? t('orders.form.invalidDate') : undefined);

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['shipments', user?.uid] }),
      qc.invalidateQueries({ queryKey: ['orders', user?.uid] }),
    ]);

  const save = async () => {
    setFailed(false);
    const built = buildShipmentPayload(f, !!id);
    if (!built.ok) {
      setErrors(built.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      if (id) {
        await apiFetch(`/api/shipments?id=${encodeURIComponent(id)}`, { method: 'PUT', body: built.input });
      } else {
        await apiFetch('/api/shipments', { method: 'POST', body: { ...built.input, orderId } });
      }
      await refresh();
      router.replace(`/order/${orderId}`);
    } catch (e) {
      void e;
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!id) return;
    const ok = await confirmAction({
      title: t('edit.shipment.deleteTitle'),
      message: t('edit.shipment.deleteBody'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
    });
    if (!ok) return;
    setBusy(true);
    try {
      await apiFetch(`/api/shipments?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      await refresh();
      router.replace(`/order/${orderId}`);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: id ? t('edit.shipment.editTitle') : t('edit.shipment.addTitle') }} />
      <View style={{ gap: spacing.md }}>
        <TextField label={`${t('orders.form.carrier')} (${t('common.optional')})`} value={f.carrier} onChangeText={(v) => set('carrier', v)} maxLength={60} />
        <TextField
          label={`${t('orders.form.trackingNumber')} (${t('common.optional')})`}
          value={f.trackingNumber}
          onChangeText={(v) => set('trackingNumber', v)}
          autoCapitalize="characters"
          maxLength={60}
        />
        <TextField
          label={t('edit.shipment.etaFrom')}
          value={f.etaFrom}
          onChangeText={(v) => set('etaFrom', v)}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
          error={dateErr('etaFrom')}
        />
        <TextField
          label={t('edit.shipment.etaTo')}
          value={f.etaTo}
          onChangeText={(v) => set('etaTo', v)}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
          error={dateErr('etaTo')}
        />

        <View style={{ gap: spacing.xs }}>
          <Text variant="label" color="textSecondary">
            {t('edit.shipment.status')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {shipmentStatus.options.map((s) => (
              <Chip
                key={s}
                label={t(`orders.status.${s}`)}
                selected={f.status === s}
                onPress={() => set('status', f.status === s ? null : s)}
              />
            ))}
          </View>
          <Text variant="caption" color="textSecondary">
            {t('edit.shipment.statusNote')}
          </Text>
        </View>
        <TextField
          label={t('edit.shipment.statusText')}
          value={f.statusText}
          onChangeText={(v) => set('statusText', v)}
          maxLength={200}
        />

        <Text variant="headline">{t('edit.shipment.pickup')}</Text>
        {!manualPickup ? (
          <>
            <Text variant="small" color="textSecondary">
              {t('orders.receive.pickupHint')}
            </Text>
            <Button variant="secondary" label={t('orders.receive.manual')} onPress={() => setManualPickup(true)} />
          </>
        ) : null}
        {manualPickup ? (
          <>
        <TextField label={t('edit.shipment.pickupName')} value={f.pickupName} onChangeText={(v) => set('pickupName', v)} maxLength={120} />
        <TextField label={t('edit.shipment.pickupAddress')} value={f.pickupAddress} onChangeText={(v) => set('pickupAddress', v)} maxLength={300} />
        <TextField
          label={t('edit.shipment.pickupUntil')}
          value={f.pickupUntil}
          onChangeText={(v) => set('pickupUntil', v)}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
          error={dateErr('pickupUntil')}
        />
        <TextField
          label={t('edit.shipment.pickupInstructions')}
          value={f.pickupInstructions}
          onChangeText={(v) => set('pickupInstructions', v)}
          maxLength={500}
          multiline
        />
        <TextField
          label={t('edit.shipment.pickupCode')}
          value={f.pickupCode}
          onChangeText={(v) => set('pickupCode', v)}
          autoCapitalize="characters"
          maxLength={60}
        />
          </>
        ) : null}

        {failed ? (
          <Text color="danger" accessibilityLiveRegion="polite">
            {t('common.saveFailed')}
          </Text>
        ) : null}
        <Button label={t('edit.shipment.save')} loading={busy} onPress={() => void save()} />
        {id ? <Button variant="ghost" label={t('edit.shipment.delete')} onPress={() => void remove()} /> : null}
      </View>
    </Screen>
  );
}
