import { useRouter } from 'expo-router';
import { Package, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Chip } from '@/components/Chip';
import { ListRow } from '@/components/ListRow';
import { SearchField } from '@/components/SearchField';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, EmptyState, ErrorState, LoadingState, Screen, Text, useTheme } from '@/design';
import { useAppLanguage, useTranslation } from '@/i18n';
import { formatDate, formatPrice } from '@/lib/format';
import { orderIsDelivered, useOrders, useShipments, type ShipmentDoc } from './hooks';

type Filter = 'all' | 'active' | 'delivered';

export function OrdersScreen() {
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const orders = useOrders();
  const shipments = useShipments();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const shipmentsByOrder = useMemo(() => {
    const map = new Map<string, ShipmentDoc[]>();
    for (const s of shipments.data ?? []) map.set(s.orderId, [...(map.get(s.orderId) ?? []), s]);
    return map;
  }, [shipments.data]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (orders.data ?? []).filter((o) => {
      const delivered = orderIsDelivered(shipmentsByOrder.get(o.id) ?? []);
      if (filter === 'active' && delivered) return false;
      if (filter === 'delivered' && !delivered) return false;
      if (!q) return true;
      const tracking = (shipmentsByOrder.get(o.id) ?? []).map((s) => s.trackingNumber ?? '').join(' ');
      return [o.merchantName, o.externalOrderId ?? '', tracking, ...o.items.map((i) => i.title)]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [orders.data, shipmentsByOrder, filter, query]);

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

  const addButton = (
    <Button
      label={t('orders.add')}
      icon={<Plus size={18} color={colors.onAccent} />}
      onPress={() => router.push('/order/add')}
    />
  );

  if ((orders.data ?? []).length === 0) {
    return (
      <Screen>
        <EmptyState
          icon={<Package size={32} color={colors.accentText} />}
          title={t('orders.emptyTitle')}
          body={t('orders.emptyBody')}
          action={addButton}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={{ gap: spacing.md }}>
        {addButton}
        <SearchField value={query} onChangeText={setQuery} placeholder={t('orders.searchPlaceholder')} />
        <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
          {(['all', 'active', 'delivered'] as const).map((f) => (
            <Chip
              key={f}
              selected={filter === f}
              onPress={() => setFilter(f)}
              label={t(`orders.filter${f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Delivered'}`)}
            />
          ))}
        </View>

        {visible.length === 0 ? (
          <Text color="textSecondary">{t('orders.noResults')}</Text>
        ) : (
          visible.map((o) => {
            const ships = shipmentsByOrder.get(o.id) ?? [];
            const first = ships[0];
            return (
              <ListRow
                key={o.id}
                title={o.merchantName}
                subtitle={[
                  o.externalOrderId,
                  formatDate(o.purchasedAt ?? o.createdAt, language),
                  formatPrice(o.total, language),
                ]
                  .filter(Boolean)
                  .join(' · ')}
                meta={
                  <View style={{ marginTop: 4, gap: 4 }}>
                    {first ? <StatusBadge status={first.status} /> : null}
                    {o.items.length > 0 ? (
                      <Text variant="caption" color="textSecondary">
                        {t('orders.items', { count: o.items.length })}
                      </Text>
                    ) : null}
                  </View>
                }
                onPress={() => router.push(`/order/${o.id}`)}
              />
            );
          })
        )}
      </View>
    </Screen>
  );
}
