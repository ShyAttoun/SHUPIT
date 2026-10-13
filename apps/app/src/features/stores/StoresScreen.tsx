import { getMerchant, merchantCatalog, type Merchant } from '@shupit/contracts';
import { ArrowDown, ArrowUp, Heart, Store } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ListRow } from '@/components/ListRow';
import { MerchantLogo } from '@/components/MerchantLogo';
import { SearchField } from '@/components/SearchField';
import { Section } from '@/components/Section';
import { Button, EmptyState, ErrorState, LoadingState, Screen, Text, useTheme } from '@/design';
import { useTranslation } from '@/i18n';
import { moveInList, toggleFavoriteList, useFavoriteStores, useStoresMutations, useStoresPreferences } from './hooks';
import { StorePicker } from './StorePicker';
import { StoresOnboarding } from './StoresOnboarding';
import { useShopNow } from './useShopNow';

export function StoresScreen() {
  const { t } = useTranslation();
  const { colors, spacing, hitTarget } = useTheme();
  const prefs = useStoresPreferences();
  const favorites = useFavoriteStores();
  const { saveFavorites } = useStoresMutations();
  const { shop, busyKey, disclosure, failed } = useShopNow();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);

  const favoriteIds = useMemo(() => (favorites.data ?? []).map((f) => f.merchantId), [favorites.data]);

  if (prefs.isLoading || favorites.isLoading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (prefs.isError || favorites.isError) {
    return (
      <Screen>
        <ErrorState
          title={t('common.somethingWrong')}
          body={t('common.somethingWrongBody')}
          retryLabel={t('common.retry')}
          onRetry={() => {
            void prefs.refetch();
            void favorites.refetch();
          }}
        />
      </Screen>
    );
  }
  if (!prefs.data?.storesOnboardingDone) {
    return <StoresOnboarding initial={favoriteIds} />;
  }

  const q = query.trim().toLowerCase();
  const matches = (m: Merchant) => !q || m.name.toLowerCase().includes(q) || m.domains.some((d) => d.includes(q));
  const favoriteMerchants = favoriteIds
    .map((id) => getMerchant(id))
    .filter((m): m is Merchant => !!m && matches(m));
  const otherMerchants = merchantCatalog.filter((m) => !favoriteIds.includes(m.id) && matches(m));

  const persist = (ids: string[]) => saveFavorites.mutate({ ids });

  const shopButton = (m: Merchant) => (
    <Button
      label={t('stores.shopNow')}
      variant="secondary"
      loading={busyKey === m.id}
      onPress={() => void shop({ merchantId: m.id })}
      style={{ minHeight: hitTarget, paddingHorizontal: spacing.md }}
    />
  );

  if (editing) {
    return (
      <Screen scroll>
        <View style={{ gap: spacing.lg }}>
          <Text variant="title" accessibilityRole="header">
            {t('stores.editFavorites')}
          </Text>
          <StorePicker selected={favoriteIds} onToggle={(id) => persist(toggleFavoriteList(favoriteIds, id))} />
          {favoriteIds.length > 1 ? (
            <Section title={t('stores.favorites')}>
              {favoriteIds.map((id, i) => {
                const m = getMerchant(id);
                if (!m) return null;
                const first = i === 0;
                const last = i === favoriteIds.length - 1;
                return (
                  <ListRow
                    key={id}
                    leading={<MerchantLogo name={m.name} />}
                    title={m.name}
                    trailing={
                      <View style={{ flexDirection: 'row' }}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${t('stores.moveUp')}: ${m.name}`}
                          disabled={first}
                          onPress={() => persist(moveInList(favoriteIds, id, -1))}
                          style={{ width: hitTarget, height: hitTarget, alignItems: 'center', justifyContent: 'center', opacity: first ? 0.3 : 1 }}
                        >
                          <ArrowUp size={20} color={colors.text} />
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${t('stores.moveDown')}: ${m.name}`}
                          disabled={last}
                          onPress={() => persist(moveInList(favoriteIds, id, 1))}
                          style={{ width: hitTarget, height: hitTarget, alignItems: 'center', justifyContent: 'center', opacity: last ? 0.3 : 1 }}
                        >
                          <ArrowDown size={20} color={colors.text} />
                        </Pressable>
                      </View>
                    }
                  />
                );
              })}
            </Section>
          ) : null}
          {saveFavorites.isError ? <Text color="danger">{t('common.saveFailed')}</Text> : null}
          <Button label={t('common.done')} onPress={() => setEditing(false)} />
        </View>
      </Screen>
    );
  }

  const nothingAtAll = favoriteIds.length === 0 && !q;

  return (
    <Screen scroll>
      <View style={{ gap: spacing.lg }}>
        <SearchField value={query} onChangeText={setQuery} placeholder={t('stores.searchPlaceholder')} />

        {disclosure ? (
          <Text variant="small" color="textSecondary" accessibilityLiveRegion="polite">
            {disclosure}
          </Text>
        ) : null}
        {failed ? (
          <Text variant="small" color="danger" accessibilityLiveRegion="polite">
            {t('wishlist.detail.openFailed')}
          </Text>
        ) : null}

        <Section
          title={t('stores.favorites')}
          action={
            <Button
              variant="ghost"
              label={t('stores.editFavorites')}
              onPress={() => setEditing(true)}
              style={{ minHeight: hitTarget }}
            />
          }
        >
          {favoriteMerchants.length === 0 ? (
            nothingAtAll ? (
              <EmptyState
                icon={<Store size={32} color={colors.accentText} />}
                title={t('stores.emptyTitle')}
                body={t('stores.emptyBody')}
                action={<Button label={t('stores.pickStores')} onPress={() => setEditing(true)} />}
              />
            ) : (
              <Text color="textSecondary">{t('stores.noResults')}</Text>
            )
          ) : (
            favoriteMerchants.map((m) => (
              <ListRow
                key={m.id}
                leading={<MerchantLogo name={m.name} />}
                title={m.name}
                subtitle={m.domains[0]}
                trailing={shopButton(m)}
              />
            ))
          )}
        </Section>

        <Section title={t('stores.allStores')}>
          {otherMerchants.length === 0 ? (
            <Text color="textSecondary">{t('stores.noResults')}</Text>
          ) : (
            otherMerchants.map((m) => (
              <ListRow
                key={m.id}
                leading={<MerchantLogo name={m.name} />}
                title={m.name}
                subtitle={m.domains[0]}
                trailing={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xxs }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${t('stores.addToFavorites')}: ${m.name}`}
                      onPress={() => persist(toggleFavoriteList(favoriteIds, m.id))}
                      style={{ width: hitTarget, height: hitTarget, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Heart size={20} color={colors.textSecondary} />
                    </Pressable>
                    {shopButton(m)}
                  </View>
                }
              />
            ))
          )}
        </Section>

        <Text variant="caption" color="textSecondary">
          {t('stores.affiliateNote')}
        </Text>
      </View>
    </Screen>
  );
}
