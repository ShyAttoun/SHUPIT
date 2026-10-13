import { getMerchant } from '@shupit/contracts';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { Chip } from '@/components/Chip';
import { Thumb } from '@/components/Thumb';
import { Button, EmptyState, ErrorState, LoadingState, Screen, Text, useTheme } from '@/design';
import { useShopNow } from '@/features/stores/useShopNow';
import { PriceWatchPanel } from '@/features/pricewatch/PriceWatchPanel';
import { useAppLanguage, useTranslation } from '@/i18n';
import { formatDate, formatPrice } from '@/lib/format';
import { confirmAction } from '@/lib/platform';
import { useCollections, useSavedProducts, useWishlistMutations } from './hooks';

export function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const { spacing } = useTheme();
  const router = useRouter();
  const products = useSavedProducts();
  const collections = useCollections();
  const { updateProduct, deleteProduct } = useWishlistMutations();
  const { shop, busyKey, disclosure, failed } = useShopNow();

  if (products.isLoading || collections.isLoading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (products.isError) {
    return (
      <Screen>
        <ErrorState
          title={t('common.somethingWrong')}
          body={t('common.somethingWrongBody')}
          retryLabel={t('common.retry')}
          onRetry={() => void products.refetch()}
        />
      </Screen>
    );
  }

  const product = (products.data ?? []).find((p) => p.id === id);
  if (!product) {
    return (
      <Screen>
        <EmptyState title={t('wishlist.detail.notFound')} />
      </Screen>
    );
  }

  const merchant = getMerchant(product.merchantId);
  const canBuy = !!(product.productUrl || merchant);
  const toggleCollection = (cid: string) => {
    const has = product.collectionIds.includes(cid);
    updateProduct.mutate({
      id: product.id,
      patch: {
        collectionIds: has ? product.collectionIds.filter((x) => x !== cid) : [...product.collectionIds, cid],
      },
    });
  };

  const remove = async () => {
    const ok = await confirmAction({
      title: t('wishlist.detail.deleteTitle'),
      message: t('wishlist.detail.deleteBody'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
    });
    if (!ok) return;
    await deleteProduct.mutateAsync(product.id);
    router.back();
  };

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: product.title.slice(0, 40) }} />
      <View style={{ gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <Thumb imageUrl={product.imageUrl} fallbackName={product.title} size={88} />
          <View style={{ flex: 1, gap: spacing.xxs }}>
            <Text variant="title">{product.title}</Text>
            {merchant ? <Text color="textSecondary">{merchant.name}</Text> : null}
          </View>
        </View>

        <View style={{ gap: spacing.xxs }}>
          <Text variant="label" color="textSecondary">
            {t('wishlist.detail.savedPrice')}
          </Text>
          <Text variant="headline">{formatPrice(product.savedPrice, language) ?? '—'}</Text>
          <Text variant="caption" color="textSecondary">
            {t('wishlist.detail.savedOn', { date: formatDate(product.createdAt, language) ?? '' })}
            {product.savedPrice && !product.priceVerifiedAt ? ` · ${t('wishlist.detail.priceNotVerified')}` : ''}
          </Text>
        </View>

        {product.note ? <Text>{product.note}</Text> : null}

        {canBuy ? (
          <View style={{ gap: spacing.xs }}>
            <Button
              label={busyKey ? t('wishlist.detail.opening') : t('wishlist.detail.buyAtStore')}
              loading={!!busyKey}
              onPress={() => void shop({ merchantId: product.merchantId, productUrl: product.productUrl })}
            />
            {disclosure ? (
              <Text variant="caption" color="textSecondary" accessibilityLiveRegion="polite">
                {t('wishlist.detail.affiliateDisclosure')}: {disclosure}
              </Text>
            ) : null}
            {failed ? <Text color="danger">{t('wishlist.detail.openFailed')}</Text> : null}
          </View>
        ) : null}

        <PriceWatchPanel product={product} />

        {(collections.data ?? []).length > 0 ? (
          <View style={{ gap: spacing.xs }}>
            <Text variant="label" color="textSecondary">
              {t('wishlist.add.collection')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {(collections.data ?? []).map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  selected={product.collectionIds.includes(c.id)}
                  onPress={() => toggleCollection(c.id)}
                />
              ))}
            </View>
          </View>
        ) : null}

        <Button
          variant="ghost"
          label={t('wishlist.detail.delete')}
          loading={deleteProduct.isPending}
          onPress={() => void remove()}
        />
      </View>
    </Screen>
  );
}
