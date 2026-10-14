import { collection, getDocs } from 'firebase/firestore';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import { pickScreenshot } from '@/lib/imagePicker';
import { useAiConsent } from '@/features/privacy/AiConsent';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { merchantByName } from '@shupit/contracts';
import type { TrackingEvent } from '@shupit/contracts';
import { StatusBadge } from '@/components/StatusBadge';
import { ShipmentProgress } from '@/components/ShipmentProgress';
import { AiWait } from '@/components/AiWait';
import { useShopNow } from '@/features/stores/useShopNow';
import { Button, EmptyState, ErrorState, LoadingState, Screen, Text, TextField, useTheme, useToast } from '@/design';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAppLanguage, useTranslation } from '@/i18n';
import { db } from '@/lib/firebase';
import { formatDate, formatDateTime, formatDateTimeWall, formatPrice } from '@/lib/format';
import { Thumb } from '@/components/Thumb';
import { confirmAction } from '@/lib/platform';
import { useOrderMutations, useOrders, useShipments, type ShipmentDoc } from './hooks';

function RefreshButton({ shipment }: { shipment: ShipmentDoc }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const refresh = useMutation({
    mutationFn: () =>
      apiFetch<{ outcome: string }>(`/api/shipments-refresh?id=${encodeURIComponent(shipment.id)}`, { method: 'POST' }),
    onSuccess: async (res) => {
      setMessage(
        res.outcome === 'not_configured'
          ? t('orders.detail.notConfigured')
          : res.outcome === 'too_soon'
            ? t('orders.detail.tooSoon')
            : res.outcome === 'provider_error'
              ? t('orders.detail.refreshFailed')
              : t('orders.detail.refreshed'),
      );
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['shipments', user?.uid] }),
        qc.invalidateQueries({ queryKey: ['trackingEvents', user?.uid, shipment.id] }),
        qc.invalidateQueries({ queryKey: ['notifications', user?.uid] }),
      ]);
    },
    onError: () => setMessage(t('orders.detail.refreshFailed')),
  });
  return (
    <View style={{ gap: 4 }}>
      <Button
        variant="secondary"
        label={refresh.isPending ? t('orders.detail.checking') : t('orders.detail.checkUpdates')}
        loading={refresh.isPending}
        onPress={() => refresh.mutate()}
      />
      {message ? (
        <Text variant="caption" color="textSecondary" accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
    </View>
  );
}

function StatusFromScreenshot({ shipment }: { shipment: ShipmentDoc }) {
  const { t } = useTranslation();
  const consent = useAiConsent();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const update = useMutation({
    mutationFn: async () => {
      if (!(await consent.ensure())) return null;
      const picked = await pickScreenshot();
      if (!picked) return null;
      return apiFetch<{ status: string }>(`/api/shipments-status?id=${encodeURIComponent(shipment.id)}`, {
        method: 'POST',
        body: { kind: 'order', imageBase64: picked.base64, mediaType: picked.mediaType },
      });
    },
    onSuccess: async (res) => {
      if (!res) return;
      setMessage(t('orders.detail.updated'));
      await qc.invalidateQueries({ queryKey: ['shipments', user?.uid] });
    },
    onError: (e) => {
      setMessage(
        e instanceof ApiError && e.code === 'consent_required'
          ? t('orders.import.consentRequired')
          : e instanceof ApiError && e.code === 'no_status'
          ? t('orders.detail.noStatus')
          : e instanceof ApiError && e.code === 'not_configured'
            ? t('orders.import.notConfigured')
            : e instanceof ApiError && e.code === 'quota_exceeded'
              ? t('orders.import.quota')
              : t('orders.import.generic'),
      );
    },
  });
  return (
    <View style={{ gap: 4 }}>
      {consent.modal}
      <Button
        variant="secondary"
        label={update.isPending ? t('orders.detail.updating') : t('orders.detail.updateFromScreenshot')}
        loading={update.isPending}
        onPress={() => update.mutate()}
      />
      <AiWait active={update.isPending} />
      {message ? (
        <Text variant="caption" color="textSecondary" accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
    </View>
  );
}

function PickupFromMessage({ shipment }: { shipment: ShipmentDoc }) {
  const { t } = useTranslation();
  const consent = useAiConsent();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState('');

  const send = useMutation({
    mutationFn: async (source: 'text' | 'image') => {
      if (!(await consent.ensure())) return null;
      if (source === 'text') {
        return apiFetch(`/api/shipments-pickup?id=${encodeURIComponent(shipment.id)}`, {
          method: 'POST',
          body: { kind: 'order', text: text.trim() },
        });
      }
      const picked = await pickScreenshot();
      if (!picked) return null;
      return apiFetch(`/api/shipments-pickup?id=${encodeURIComponent(shipment.id)}`, {
        method: 'POST',
        body: { kind: 'order', imageBase64: picked.base64, mediaType: picked.mediaType },
      });
    },
    onSuccess: async (res) => {
      if (!res) return;
      setMessage(t('orders.receive.pickupSaved'));
      setPasting(false);
      setText('');
      await qc.invalidateQueries({ queryKey: ['shipments', user?.uid] });
    },
    onError: (e) => {
      setMessage(
        e instanceof ApiError && e.code === 'consent_required'
          ? t('orders.import.consentRequired')
          : e instanceof ApiError && e.code === 'no_pickup'
            ? t('orders.receive.noPickup')
            : e instanceof ApiError && e.code === 'not_configured'
              ? t('orders.import.notConfigured')
              : e instanceof ApiError && e.code === 'quota_exceeded'
                ? t('orders.import.quota')
                : t('orders.import.generic'),
      );
    },
  });

  return (
    <View style={{ gap: 8 }}>
      {consent.modal}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button variant="secondary" label={t('orders.receive.pickPaste')} onPress={() => setPasting((v) => !v)} />
        <Button
          variant="secondary"
          label={t('orders.receive.pickShot')}
          loading={send.isPending && send.variables === 'image'}
          onPress={() => send.mutate('image')}
        />
      </View>
      <AiWait active={send.isPending} />
      {pasting ? (
        <View style={{ gap: 8 }}>
          <TextField
            label={t('orders.receive.pasteTitle')}
            placeholder={t('orders.receive.pastePlaceholder')}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={2000}
          />
          <Button
            label={send.isPending ? t('orders.receive.reading') : t('orders.receive.read')}
            disabled={text.trim().length < 10}
            loading={send.isPending && send.variables === 'text'}
            onPress={() => send.mutate('text')}
          />
        </View>
      ) : null}
      {message ? (
        <Text variant="caption" color="textSecondary" accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
    </View>
  );
}

function Timeline({ shipment }: { shipment: ShipmentDoc }) {
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const { user } = useAuth();
  const { colors, spacing } = useTheme();
  const events = useQuery({
    queryKey: ['trackingEvents', user?.uid, shipment.id],
    enabled: !!user,
    queryFn: async (): Promise<(TrackingEvent & { timeIsWallClock?: boolean })[]> => {
      const snap = await getDocs(collection(db, 'users', user!.uid, 'shipments', shipment.id, 'trackingEvents'));
      return snap.docs
        .map((d) => d.data() as TrackingEvent & { timeIsWallClock?: boolean })
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    },
  });

  if (events.isLoading) return <LoadingState rows={1} />;
  if (events.isError || (events.data ?? []).length === 0) {
    return (
      <Text variant="small" color="textSecondary">
        {t('orders.detail.timelineEmpty')}
      </Text>
    );
  }
  return (
    <View style={{ gap: spacing.sm }}>
      {(events.data ?? []).map((e) => (
        <View key={e.id} style={{ gap: 2, paddingStart: spacing.sm, borderStartWidth: 2, borderStartColor: colors.accent }}>
          {e.description ? (
            <Text variant="bodyStrong">{e.description}</Text>
          ) : (
            <Text variant="bodyStrong">{t(`orders.status.${e.status}`)}</Text>
          )}
          <Text variant="caption" color="textSecondary">
            {e.timeIsWallClock ? formatDateTimeWall(e.occurredAt, language) : formatDateTime(e.occurredAt, language)}
            {e.location?.text ? ` · ${e.location.text}` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const theme = useTheme();
  const { colors, spacing, radius } = theme;
  const router = useRouter();
  const orders = useOrders();
  const shipments = useShipments();
  const { deleteOrder, markReceived, restore } = useOrderMutations();
  const toast = useToast();
  const { shop, busyKey, failed: shopFailed } = useShopNow();

  if (orders.isLoading || shipments.isLoading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (orders.isError || shipments.isError) {
    return (
      <Screen>
        <ErrorState
          title={t('common.somethingWrong')}
          body={t('common.somethingWrongBody')}
          retryLabel={t('common.retry')}
          onRetry={() => {
            void orders.refetch();
            void shipments.refetch();
          }}
        />
      </Screen>
    );
  }
  const order = (orders.data ?? []).find((o) => o.id === id);
  if (!order) {
    return (
      <Screen>
        <EmptyState title={t('orders.detail.notFound')} />
      </Screen>
    );
  }
  const ships = (shipments.data ?? []).filter((s) => s.orderId === order.id);

  const remove = async () => {
    const ok = await confirmAction({
      title: t('orders.detail.deleteTitle'),
      message: t('orders.detail.deleteBody'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
    });
    if (!ok) return;
    await deleteOrder.mutateAsync(order.id);
    router.replace('/orders');
  };

  const kv = (label: string, value: string | null | undefined) =>
    value ? (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
        <Text color="textSecondary">{label}</Text>
        <Text variant="bodyStrong" style={{ flexShrink: 1, textAlign: theme.endAlign }}>
          {value}
        </Text>
      </View>
    ) : null;

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: order.merchantName }} />
      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.xs }}>
          <Text variant="title">{order.merchantName}</Text>
          {kv(t('orders.detail.orderNumber'), order.externalOrderId)}
          {order.purchasedAt
            ? kv(t('orders.form.purchaseDate'), formatDate(order.purchasedAt, language))
            : null}
          {kv(t('orders.form.total'), formatPrice(order.total, language))}
          <Text variant="caption" color="textSecondary">
            {t('orders.detail.importedFrom')} {t('orders.detail.sourceManual')}
          </Text>
        </View>

        {order.archivedAt ? (
          <View style={{ gap: spacing.xs }}>
            <Text color="textSecondary">{t('orders.receive.archivedNote')}</Text>
            <Button
              variant="secondary"
              label={t('orders.receive.restore')}
              loading={restore.isPending}
              onPress={() => restore.mutate(order.id)}
            />
          </View>
        ) : (
          <Button
            label={t('orders.receive.received')}
            loading={markReceived.isPending}
            onPress={() =>
              markReceived.mutate(
                { orderId: order.id, shipments: ships },
                {
                  onSuccess: () => {
                    toast.show(t('orders.receive.receivedDone'));
                    router.replace('/orders');
                  },
                },
              )
            }
          />
        )}

        {order.merchantId || merchantByName(order.merchantName) ? (
          <Button
            variant="secondary"
            label={t('orders.detail.openStore', { store: order.merchantName })}
            loading={busyKey === (order.merchantId ?? merchantByName(order.merchantName)?.id)}
            onPress={() => void shop({ merchantId: order.merchantId ?? merchantByName(order.merchantName)?.id })}
          />
        ) : null}
        {shopFailed ? (
          <Text color="danger" accessibilityLiveRegion="polite">
            {t('wishlist.detail.openFailed')}
          </Text>
        ) : null}

        <Button
          variant="secondary"
          label={t('orders.detail.editOrder')}
          onPress={() => router.push(`/order/edit/${order.id}`)}
        />

        {order.items.length > 0 ? (
          <View style={{ gap: spacing.xs }}>
            <Text variant="headline">{t('orders.detail.itemsHeading')}</Text>
            <View
              style={{
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  padding: spacing.sm,
                  backgroundColor: colors.surface,
                }}
              >
                <Text variant="caption" color="textSecondary" style={{ width: 56, textAlign: 'center' }}>
                  {t('orders.detail.tableImage')}
                </Text>
                <Text variant="caption" color="textSecondary" style={{ flex: 1 }}>
                  {t('orders.detail.tableItem')}
                </Text>
                <Text variant="caption" color="textSecondary" style={{ width: 44, textAlign: 'center' }}>
                  {t('orders.detail.tableQty')}
                </Text>
              </View>
              {order.items.map((it, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    padding: spacing.sm,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <View style={{ width: 56, alignItems: 'center' }}>
                    <Thumb imageUrl={it.imageUrl} fallbackName={it.title} size={48} />
                  </View>
                  {it.productUrl ? (
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel={`${t('orders.detail.openItem')}: ${it.title}`}
                      onPress={() => void shop({ merchantId: order.merchantId, productUrl: it.productUrl })}
                      style={{ flex: 1, gap: 2 }}
                    >
                      <Text numberOfLines={3}>{it.title}</Text>
                      <Text variant="caption" color="accentText">
                        {t('orders.detail.openItem')}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={{ flex: 1 }} numberOfLines={3}>
                      {it.title}
                    </Text>
                  )}
                  <Text variant="bodyStrong" style={{ width: 44, textAlign: 'center' }}>
                    {it.quantity}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ gap: spacing.sm }}>
          <Text variant="headline">{t('orders.detail.shipments')}</Text>
          {ships.length === 0 ? (
            <Text color="textSecondary">{t('orders.detail.noShipments')}</Text>
          ) : (
            ships.map((s) => (
              <View
                key={s.id}
                style={{
                  gap: spacing.sm,
                  padding: spacing.md,
                  borderRadius: radius.xl,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  ...theme.elevation(1),
                }}
              >
                <StatusBadge status={s.status} />
                <ShipmentProgress status={s.status} labels />
                {s.statusText ? kv(t('orders.detail.carrierStatus'), s.statusText) : null}
                {s.statusSource === 'user' && s.statusAsOf ? (
                  <Text variant="caption" color="textSecondary">
                    {t('orders.detail.statusSetByYou', { date: formatDate(s.statusAsOf, language) ?? '' })}
                  </Text>
                ) : null}
                {s.statusSource === 'ai_vision' && s.statusAsOf ? (
                  <Text variant="caption" color="textSecondary">
                    {t('orders.detail.statusFromScreenshot', { date: formatDate(s.statusAsOf, language) ?? '' })}
                  </Text>
                ) : null}
                {kv(t('orders.detail.carrier'), s.carrier)}
                {kv(t('orders.detail.trackingNumber'), s.trackingNumber)}
                {s.estimatedDeliveryAt
                  ? kv(
                      s.estimatedDeliveryFrom ? t('orders.detail.etaWindow') : t('orders.detail.eta'),
                      `${s.estimatedDeliveryFrom ? `${formatDate(s.estimatedDeliveryFrom, language)} – ` : ''}${formatDate(s.estimatedDeliveryAt, language)}${s.estimatedDeliverySource === 'user' ? ` (${t('orders.detail.etaUser')})` : ''}`,
                    )
                  : null}
                {s.pickup && Object.values(s.pickup).some(Boolean) ? (
                  <View style={{ gap: spacing.xs, paddingVertical: spacing.xs }}>
                    <Text variant="label" color="textSecondary">
                      {t('orders.detail.pickupHeading')}
                    </Text>
                    {s.pickup.name ? <Text variant="bodyStrong">{s.pickup.name}</Text> : null}
                    {s.pickup.address ? <Text>{s.pickup.address}</Text> : null}
                    {kv(t('orders.detail.pickupUntil'), formatDate(s.pickup.until, language))}
                    {s.pickup.instructions ? <Text variant="small">{s.pickup.instructions}</Text> : null}
                    {kv(t('orders.detail.collectionCode'), s.pickup.code)}
                  </View>
                ) : null}
                {s.status !== 'delivered' && s.status !== 'returned' ? <PickupFromMessage shipment={s} /> : null}
                {kv(t('orders.detail.lastUpdate'), formatDateTime(s.lastVerifiedAt, language))}
                <Button
                  variant="ghost"
                  label={t('edit.shipment.edit')}
                  onPress={() => router.push(`/shipment/${order.id}?id=${s.id}`)}
                />
                {s.status !== 'delivered' && s.status !== 'returned' ? <StatusFromScreenshot shipment={s} /> : null}
                {s.trackingNumber && s.status !== 'delivered' && s.status !== 'returned' ? (
                  <RefreshButton shipment={s} />
                ) : null}
                <Text variant="label" color="textSecondary">
                  {t('orders.detail.timeline')}
                </Text>
                <Timeline shipment={s} />
              </View>
            ))
          )}
          <Button
            variant="secondary"
            label={t('edit.shipment.add')}
            onPress={() => router.push(`/shipment/${order.id}`)}
          />
        </View>

        {deleteOrder.isError ? <Text color="danger">{t('common.saveFailed')}</Text> : null}
        <Button
          variant="ghost"
          label={t('orders.detail.delete')}
          loading={deleteOrder.isPending}
          onPress={() => void remove()}
        />
      </View>
    </Screen>
  );
}
