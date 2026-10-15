import type { Order } from '@shupit/contracts';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useFavoriteStores } from '@/features/stores/hooks';
import { shouldPromptStores, useFirstRunStore } from '@/features/stores/firstRun';
import { shouldShowWalkthrough, useWalkthroughStore } from '@/features/walkthrough/store';
import { Home, PackagePlus, PlusCircle } from 'lucide-react-native';
import { View } from 'react-native';
import { ListRow } from '@/components/ListRow';
import { Section } from '@/components/Section';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, EmptyState, Grid, ErrorState, LoadingState, Screen, Text, useTheme } from '@/design';
import { arrivingSoon, isActiveShipment, useOrders, useShipments, type ShipmentDoc } from '@/features/orders/hooks';
import { useAppLanguage, useTranslation } from '@/i18n';
import { formatDate } from '@/lib/format';
import { notificationRoute, notificationTitle } from '@/features/notifications/format';
import { CouponsSection } from './CouponsSection';
import { HomeHero } from './HomeHero';
import { ShipmentProgress } from '@/components/ShipmentProgress';
import { Thumb } from '@/components/Thumb';
import { formatPrice } from '@/lib/format';
import { WishlistCarousel } from './WishlistCarousel';
import { useSavedProducts } from '@/features/wishlist/hooks';
import { useNotificationActions, useNotifications } from '@/features/notifications/hooks';

export function HomeScreen() {
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const orders = useOrders();
  const shipments = useShipments();
  const { user } = useAuth();
  const favorites = useFavoriteStores();
  const { promptedFor, markPrompted } = useFirstRunStore();
  const { seenFor, replaying } = useWalkthroughStore();
  // The welcome tour owns first-run store selection; the redirect only applies once it is out of the way.
  const tourPending = shouldShowWalkthrough({ uid: user?.uid, seenFor, replaying });

  // First entry to the app with no favorite stores: take the user to store selection once.
  useEffect(() => {
    if (
      shouldPromptStores({
        loaded: favorites.isSuccess && !tourPending,
        favoriteCount: favorites.data?.length ?? 0,
        promptedFor,
        uid: user?.uid,
      })
    ) {
      markPrompted(user!.uid);
      router.replace('/stores');
    }
  }, [favorites.isSuccess, favorites.data, promptedFor, user, markPrompted, router, tourPending]);
  const saved = useSavedProducts();
  const notifications = useNotifications();
  const { markRead } = useNotificationActions();

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

  const liked = (saved.data ?? []).slice(0, 12);
  // Only prices the user verified on the store's page, in the same currency as the saved price.
  const drops = (saved.data ?? []).filter((p) => {
    const now = p.latestObservation?.price;
    return !!now && !!p.savedPrice && now.currency === p.savedPrice.currency && now.amountMinor < p.savedPrice.amountMinor;
  });
  const hero = <HomeHero active={active.length} pickup={pickup.length} />;
  const favoriteIds = (favorites.data ?? []).map((f) => f.merchantId);

  const quickActions = (
    <Section tone="actions" title={t('home.quickActions')}>
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
        <View style={{ gap: spacing.lg }}>
        {hero}
        <EmptyState
          icon={<Home size={32} color={colors.accentText} />}
          title={t('home.emptyTitle')}
          body={t('home.emptyBody')}
        />
        {liked.length > 0 ? (
          <Section tone="liked" title={t('home.liked')}>
            <WishlistCarousel products={liked} onOpen={(p) => router.push(`/product/${p.id}`)} />
          </Section>
        ) : null}
        <CouponsSection favoriteIds={favoriteIds} />
        {quickActions}
        </View>
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
            <ShipmentProgress status={s.status} />
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
        {hero}
        <Grid>
        {updates.length > 0 ? (
          <Section
            tone="alerts"
            title={t('notifications.title')}
            action={<Button variant="ghost" label={t('home.seeAll')} onPress={() => router.push('/notifications')} />}
          >
            {updates.map((n) => (
              <ListRow
                key={n.id}
                title={notificationTitle(n, t as never, language)}
                subtitle={formatDate(n.createdAt, language)}
                onPress={() => {
                  markRead.mutate([n.id]);
                  const route = notificationRoute(n);
                  if (route) router.push(route as never);
                }}
              />
            ))}
          </Section>
        ) : null}
        {drops.length > 0 ? (
          <Section tone="drops" title={t('home.drops')}>
            <Text variant="caption" color="textSecondary">
              {t('home.dropsNote')}
            </Text>
            {drops.slice(0, 4).map((p) => (
              <ListRow
                key={p.id}
                leading={<Thumb imageUrl={p.thumbDataUrl ?? p.imageUrl} fallbackName={p.title} size={48} />}
                title={p.title}
                subtitle={`${formatPrice(p.latestObservation!.price, language)} · ${t('home.dropFrom', {
                  price: formatPrice(p.savedPrice, language) ?? '',
                })}`}
                onPress={() => router.push(`/product/${p.id}`)}
              />
            ))}
          </Section>
        ) : null}
        {liked.length > 0 ? (
          <Section
            tone="liked"
            title={t('home.liked')}
            action={<Button variant="ghost" label={t('home.seeAll')} onPress={() => router.push('/wishlist')} />}
          >
            <WishlistCarousel products={liked} onOpen={(p) => router.push(`/product/${p.id}`)} />
          </Section>
        ) : null}
        <CouponsSection favoriteIds={favoriteIds} />
        {pickup.length > 0 ? <Section tone="shipments" title={t('home.readyForPickup')}>{pickup.map(shipmentRow)}</Section> : null}
        {soon.length > 0 ? <Section tone="shipments" title={t('home.arrivingSoon')}>{soon.map(shipmentRow)}</Section> : null}
        {active.length > 0 ? (
          <Section tone="shipments" title={t('home.activeDeliveries')}>
            {active.map(shipmentRow)}
            {active.some((s) => s.status === 'unknown') ? (
              <Text variant="caption" color="textSecondary">
                {t('home.unverifiedNote')}
              </Text>
            ) : null}
          </Section>
        ) : null}
        <Section
          tone="orders"
          title={t('home.recentOrders')}
          action={<Button variant="ghost" label={t('home.seeAll')} onPress={() => router.push('/orders')} />}
        >
          {recent.map(orderRow)}
        </Section>
        </Grid>
        {quickActions}
      </View>
    </Screen>
  );
}
