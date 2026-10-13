import { collection, getDocs } from 'firebase/firestore';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import type { TrackingEvent } from '@shupit/contracts';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, EmptyState, ErrorState, LoadingState, Screen, Text, useTheme } from '@/design';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAppLanguage, useTranslation } from '@/i18n';
import { db } from '@/lib/firebase';
import { formatDate, formatDateTime, formatPrice } from '@/lib/format';
import { confirmAction } from '@/lib/platform';
import { useOrderMutations, useOrders, useShipments, type ShipmentDoc } from './hooks';

function Timeline({ shipment }: { shipment: ShipmentDoc }) {
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const { user } = useAuth();
  const { colors, spacing } = useTheme();
  const events = useQuery({
    queryKey: ['trackingEvents', user?.uid, shipment.id],
    enabled: !!user,
    queryFn: async (): Promise<TrackingEvent[]> => {
      const snap = await getDocs(collection(db, 'users', user!.uid, 'shipments', shipment.id, 'trackingEvents'));
      return snap.docs
        .map((d) => d.data() as TrackingEvent)
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
          <Text variant="bodyStrong">{t(`orders.status.${e.status}`)}</Text>
          {e.description ? <Text variant="small">{e.description}</Text> : null}
          <Text variant="caption" color="textSecondary">
            {formatDateTime(e.occurredAt, language)}
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
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const orders = useOrders();
  const shipments = useShipments();
  const { deleteOrder } = useOrderMutations();

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
    router.back();
  };

  const kv = (label: string, value: string | null | undefined) =>
    value ? (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
        <Text color="textSecondary">{label}</Text>
        <Text variant="bodyStrong" style={{ flexShrink: 1, textAlign: 'right' }}>
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

        {order.items.length > 0 ? (
          <View style={{ gap: spacing.xs }}>
            <Text variant="headline">{t('orders.detail.itemsHeading')}</Text>
            {order.items.map((it, i) => (
              <Text key={i}>
                {it.quantity} × {it.title}
              </Text>
            ))}
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
                style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface }}
              >
                <StatusBadge status={s.status} />
                {kv(t('orders.detail.carrier'), s.carrier)}
                {kv(t('orders.detail.trackingNumber'), s.trackingNumber)}
                {s.estimatedDeliveryAt
                  ? kv(
                      t('orders.detail.eta'),
                      `${formatDate(s.estimatedDeliveryAt, language)}${s.estimatedDeliverySource === 'user' ? ` (${t('orders.detail.etaUser')})` : ''}`,
                    )
                  : null}
                {kv(t('orders.detail.lastUpdate'), formatDateTime(s.lastVerifiedAt, language))}
                <Text variant="label" color="textSecondary">
                  {t('orders.detail.timeline')}
                </Text>
                <Timeline shipment={s} />
              </View>
            ))
          )}
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
