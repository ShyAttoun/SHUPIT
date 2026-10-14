import { getMerchant, merchantMatchesQuery } from '@shupit/contracts';
import { useRouter } from 'expo-router';
import { Heart, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Chip } from '@/components/Chip';
import { MerchantLogo } from '@/components/MerchantLogo';
import { useShopNow } from '@/features/stores/useShopNow';
import { groupByBrand } from './grouping';
import { ProductCard } from './ProductCard';
import { SearchField } from '@/components/SearchField';
import { Button, EmptyState, Grid, ErrorState, LoadingState, Screen, Text, TextField, useTheme } from '@/design';
import { useTranslation } from '@/i18n';
import { confirmAction } from '@/lib/platform';
import { useCollections, useSavedProducts, useWishlistMutations } from './hooks';

export function WishlistScreen() {
  const { t } = useTranslation();
  const { shop, busyKey, failed: shopFailed } = useShopNow();
  const { colors, spacing, hitTarget } = useTheme();
  const router = useRouter();
  const products = useSavedProducts();
  const collections = useCollections();
  const { createCollection, renameCollection, deleteCollection } = useWishlistMutations();

  const [active, setActive] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [nameDraft, setNameDraft] = useState<string | null>(null); // null = closed
  const [renaming, setRenaming] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (products.data ?? []).filter(
      (p) =>
        (!active || p.collectionIds.includes(active)) &&
        (!q || p.title.toLowerCase().includes(q) || (() => { const m = getMerchant(p.merchantId); return !!m && merchantMatchesQuery(m, q); })()),
    );
  }, [products.data, active, query]);
  const brandGroups = useMemo(() => groupByBrand(visible), [visible]);

  if (products.isLoading || collections.isLoading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (products.isError || collections.isError) {
    return (
      <Screen>
        <ErrorState
          title={t('common.somethingWrong')}
          body={t('common.somethingWrongBody')}
          retryLabel={t('common.retry')}
          onRetry={() => {
            void products.refetch();
            void collections.refetch();
          }}
        />
      </Screen>
    );
  }

  const all = products.data ?? [];
  const cols = collections.data ?? [];
  const activeCollection = cols.find((c) => c.id === active);

  const submitName = async () => {
    const name = (nameDraft ?? '').trim();
    if (!name) return;
    if (renaming && activeCollection) {
      await renameCollection.mutateAsync({ id: activeCollection.id, name });
    } else {
      const created = await createCollection.mutateAsync({ name, order: cols.length });
      setActive(created.id);
    }
    setNameDraft(null);
    setRenaming(false);
  };

  const removeCollection = async () => {
    if (!activeCollection) return;
    const ok = await confirmAction({
      title: t('wishlist.deleteCollectionTitle'),
      message: t('wishlist.deleteCollectionBody'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
    });
    if (!ok) return;
    await deleteCollection.mutateAsync(activeCollection.id);
    setActive(null);
  };

  const addButton = (
    <Button
      label={t('wishlist.addProduct')}
      icon={<Plus size={18} color={colors.onAccent} />}
      onPress={() => router.push('/product/add')}
    />
  );

  if (all.length === 0 && cols.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon={<Heart size={32} color={colors.accentText} />}
          title={t('wishlist.emptyTitle')}
          body={t('wishlist.emptyBody')}
          action={addButton}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={{ gap: spacing.md }}>
        {addButton}
        <SearchField value={query} onChangeText={setQuery} placeholder={t('wishlist.searchPlaceholder')} />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          <Chip label={t('wishlist.allItems')} selected={active === null} onPress={() => setActive(null)} />
          {cols.map((c) => (
            <Chip key={c.id} label={c.name} selected={active === c.id} onPress={() => setActive(c.id)} />
          ))}
          <Chip
            label={`+ ${t('wishlist.newCollection')}`}
            onPress={() => {
              setRenaming(false);
              setNameDraft('');
            }}
          />
        </View>

        {activeCollection && nameDraft === null ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              variant="secondary"
              label={t('wishlist.renameCollection')}
              style={{ minHeight: hitTarget }}
              onPress={() => {
                setRenaming(true);
                setNameDraft(activeCollection.name);
              }}
            />
            <Button
              variant="ghost"
              label={t('wishlist.deleteCollection')}
              style={{ minHeight: hitTarget }}
              onPress={() => void removeCollection()}
            />
          </View>
        ) : null}

        {nameDraft !== null ? (
          <View style={{ gap: spacing.sm }}>
            <TextField
              label={t('wishlist.collectionName')}
              value={nameDraft}
              onChangeText={setNameDraft}
              maxLength={80}
              autoFocus
              onSubmitEditing={() => void submitName()}
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button
                label={t('common.save')}
                disabled={!nameDraft.trim()}
                loading={createCollection.isPending || renameCollection.isPending}
                onPress={() => void submitName()}
              />
              <Button variant="ghost" label={t('common.cancel')} onPress={() => setNameDraft(null)} />
            </View>
          </View>
        ) : null}

        {shopFailed ? (
          <Text color="danger" accessibilityLiveRegion="polite">
            {t('wishlist.detail.openFailed')}
          </Text>
        ) : null}

        {visible.length === 0 ? (
          <Text color="textSecondary">{t('wishlist.noResults')}</Text>
        ) : (
          brandGroups.map((g) => (
            <View key={g.key} style={{ gap: spacing.sm }} accessibilityRole="summary">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <MerchantLogo name={g.name ?? t('wishlist.otherStores')} domain={g.domain ?? undefined} size={44} />
                <View style={{ flex: 1 }}>
                  <Text variant="headline" accessibilityRole="header">
                    {g.name ?? t('wishlist.otherStores')}
                  </Text>
                  <Text variant="small" color="textSecondary">
                    {t('wishlist.brandCount', { count: g.count })}
                  </Text>
                </View>
              </View>

              {g.sites.map((site) => (
                <View key={site.host ?? 'none'} style={{ gap: spacing.sm }}>
                  {g.sites.length > 1 && site.host ? (
                    <Text variant="label" color="textSecondary">
                      {t('wishlist.siteHeading', { site: site.host })}
                    </Text>
                  ) : null}
                  <Grid>{site.items.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      onOpen={() => router.push(`/product/${p.id}`)}
                      onShop={
                        p.productUrl || p.merchantId
                          ? () => void shop({ merchantId: p.merchantId, productUrl: p.productUrl })
                          : undefined
                      }
                      shopping={busyKey === (p.productUrl ?? p.merchantId ?? '')}
                    />
                  ))}</Grid>
                </View>
              ))}
            </View>
          ))
        )}
      </View>
    </Screen>
  );
}
