import type { Order } from '@shupit/contracts';
import { useRouter } from 'expo-router';
import { Home, PackagePlus, PlusCircle } from 'lucide-react-native';
import { View } from 'react-native';
import { ListRow } from '@/components/ListRow';
import { Section } from '@/components/Section';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, EmptyState, ErrorState, LoadingState, Screen, Text, useTheme } from '@/design';
import { arrivingSoon, isActiveShipment, useOrders, useShipments, type ShipmentDoc } from '@/features/orders/hooks';
import { useAppLanguage, useTranslation } from '@/i18n';
import { formatDate } from '@/lib/format';
import { useMarkNotificationRead, useNotifications } from '@/features/orders/notifications';

export function HomeScreen() {
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const orders = useOrders();
  const shipments = useShipments();
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();

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

  const orderList = orders.data ?? [];
  const shipmentList = shipments.data ?? [];
  const byOrder = new Map(orderList.map((o) => [o.id, o]));
  const active = shipmentList.filter(isActiveShipment);
  const soon = arrivingSoon(shipmentList, new Date());
  const pickup = shipmentList.filter((s) => s.status === 'ready_for_pickup');
  const recent = orderList.slice(0, 3);
  const updates = (notifications.data ?? []).filter((n) => !n.readAt).slice(0, 5);

  const quickActions = (
    <Section title={t('home.quickActions')}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Button
          label={t('home.addOrder')}
          icon={<PackagePlus size={18} color={colors.onAccent} />}
          onPress={() => router.push('/order/add')}
        />
        <Button
          variant="secondary"
          label={t('home.saveProduct')}
          icon={<PlusCircle size={18} color={colors.text} />}
          onPress={() => router.push('/product/add')}
        />
      </View>
    </Section>
  );

  if (orderList.length === 0) {
    return (
      <Screen scroll>
        <EmptyState
          icon={<Home size={32} color={colors.accentText} />}
          title={t('home.emptyTitle')}
          body={t('home.emptyBody')}
        />
        {quickActions}
      </Screen>
    );
  }

  const shipmentRow = (s: ShipmentDoc) => {
    const o = byOrder.get(s.orderId);
    return (
      <ListRow
        key={s.id}
        title={o?.merchantName ?? '—'}
        subtitle={[s.carrier, s.trackingNumber].filter(Boolean).join(' · ') || null}
        meta={
          <View style={{ gap: 4, marginTop: 4 }}>
            <StatusBadge status={s.status} />
            {s.estimatedDeliveryAt ? (
              <Text variant="caption" color="textSecondary">
                {t('orders.detail.eta')}: {formatDate(s.estimatedDeliveryAt, language)}
              </Text>
            ) : null}
          </View>
        }
        onPress={() => router.push(`/order/${s.orderId}`)}
      />
    );
  };

  const orderRow = (o: Order) => (
    <ListRow
      key={o.id}
      title={o.merchantName}
      subtitle={o.externalOrderId ?? formatDate(o.purchasedAt ?? o.createdAt, language)}
      onPress={() => router.push(`/order/${o.id}`)}
    />
  );

  return (
    <Screen scroll>
      <View style={{ gap: spacing.lg }}>
        {updates.length > 0 ? (
          <Section title={t('notifications.title')}>
            {updates.map((n) => (
              <ListRow
                key={n.id}
                title={
                  n.type === 'shipment_eta'
                    ? t('notifications.eta', { merchant: n.merchantName, date: formatDate(n.etaTo, language) ?? '' })
                    : t(`notifications.status.${n.status}` as 'notifications.status.delivered', { merchant: n.merchantName })
                }
                subtitle={formatDate(n.createdAt, language)}
                onPress={() => {
                  markRead.mutate(n.id);
                  router.push(`/order/${n.orderId}`);
                }}
              />
            ))}
          </Section>
        ) : null}
        {pickup.length > 0 ? <Section title={t('home.readyForPickup')}>{pickup.map(shipmentRow)}</Section> : null}
        {soon.length > 0 ? <Section title={t('home.arrivingSoon')}>{soon.map(shipmentRow)}</Section> : null}
        {active.length > 0 ? (
          <Section title={t('home.activeDeliveries')}>
            {active.map(shipmentRow)}
            {active.some((s) => s.status === 'unknown') ? (
              <Text variant="caption" color="textSecondary">
                {t('home.unverifiedNote')}
              </Text>
            ) : null}
          </Section>
        ) : null}
        <Section
          title={t('home.recentOrders')}
          action={<Button variant="ghost" label={t('home.seeAll')} onPress={() => router.push('/orders')} />}
        >
          {recent.map(orderRow)}
        </Section>
        {quickActions}
      </View>
    </Screen>
  );
}
