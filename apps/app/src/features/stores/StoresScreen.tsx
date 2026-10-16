import { getMerchant, merchantMatchesQuery, type Merchant } from '@shupit/contracts';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowDown, ArrowUp, Plus, Store } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ListRow } from '@/components/ListRow';
import { MerchantLogo } from '@/components/MerchantLogo';
import { SearchField } from '@/components/SearchField';
import { Button, EmptyState, Grid, ErrorState, LoadingState, Screen, Text, useTheme } from '@/design';
import { useTranslation } from '@/i18n';
import { moveInList, useFavoriteStores, useStoresMutations } from './hooks';
import { StorePickerScreen } from './StorePickerScreen';
import { useShopNow } from './useShopNow';

export function StoresScreen() {
  const { t } = useTranslation();
  const { colors, spacing, hitTarget, radius } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ pick?: string }>();
  const favorites = useFavoriteStores();
  const { saveFavorites } = useStoresMutations();
  const { shop, busyKey, disclosure, failed } = useShopNow();
  const [query, setQuery] = useState('');
  const [reordering, setReordering] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [skipped, setSkipped] = useState(false);

  const favoriteIds = useMemo(() => (favorites.data ?? []).map((f) => f.merchantId), [favorites.data]);

  // Deep link from settings: open the picker modal.
  useEffect(() => {
    if (params.pick === '1') {
      setModalOpen(true);
      router.setParams({ pick: undefined });
    }
  }, [params.pick, router]);

  if (favorites.isLoading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (favorites.isError) {
    return (
      <Screen>
        <ErrorState
          title={t('common.somethingWrong')}
          body={t('common.somethingWrongBody')}
          retryLabel={t('common.retry')}
          onRetry={() => void favorites.refetch()}
        />
      </Screen>
    );
  }

  const save = (ids: string[]) =>
    saveFavorites.mutate(ids, { onSuccess: () => setModalOpen(false) });

  // First run, or the user has no stores: show the picker as the screen itself.
  if (favoriteIds.length === 0 && !skipped) {
    return (
      <StorePickerScreen
        initial={[]}
        title={t('stores.onboarding.title')}
        body={t('stores.onboarding.body')}
        saving={saveFavorites.isPending}
        failed={saveFavorites.isError}
        onSave={save}
        onSkip={() => setSkipped(true)}
      />
    );
  }

  const q = query.trim().toLowerCase();
  const visible = favoriteIds
    .map((id) => getMerchant(id))
    .filter((m): m is Merchant => !!m)
    .filter((m) => merchantMatchesQuery(m, q));

  const persistOrder = (ids: string[]) => saveFavorites.mutate(ids);

  return (
    <>
      <Screen scroll>
        <View style={{ gap: spacing.md }}>
          {favoriteIds.length === 0 ? (
            <EmptyState
              icon={<Store size={32} color={colors.accentText} />}
              title={t('stores.emptyTitle')}
              body={t('stores.noFavoritesYet')}
              action={<Button label={t('stores.pickStores')} onPress={() => setModalOpen(true)} />}
            />
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                <Button
                  label={t('stores.addMore')}
                  icon={<Plus size={18} color={colors.onAccent} />}
                  onPress={() => setModalOpen(true)}
                />
                {favoriteIds.length > 1 ? (
                  <Button
                    variant="secondary"
                    label={reordering ? t('common.done') : t('stores.reorder')}
                    onPress={() => setReordering((r) => !r)}
                  />
                ) : null}
              </View>

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
              {saveFavorites.isError ? <Text color="danger">{t('common.saveFailed')}</Text> : null}

              {!q && visible.length > 3 ? (
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {visible.slice(0, 3).map((m) => (
                    <Pressable
                      key={m.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('stores.shopNow')}: ${m.name}`}
                      onPress={() => void shop({ merchantId: m.id })}
                      style={({ pressed }) => ({
                        flex: 1,
                        alignItems: 'center',
                        gap: spacing.xs,
                        padding: spacing.md,
                        borderRadius: radius.xl,
                        backgroundColor: colors.accentSoft,
                        borderWidth: 1,
                        borderColor: colors.border,
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                      })}
                    >
                      <MerchantLogo name={m.name} domain={m.domains[0]} size={64} />
                      <Text variant="label" numberOfLines={1}>
                        {m.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {visible.length === 0 ? (
                <Text color="textSecondary">{t('stores.noResults')}</Text>
              ) : (
                <Grid>{visible.map((m) => {
                  const i = favoriteIds.indexOf(m.id);
                  const first = i === 0;
                  const last = i === favoriteIds.length - 1;
                  return (
                    <ListRow
                      key={m.id}
                      leading={<MerchantLogo name={m.name} domain={m.domains[0]} size={52} />}
                      title={m.name}
                      subtitle={m.domains[0]}
                      trailing={
                        reordering ? (
                          <View style={{ flexDirection: 'row' }}>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`${t('stores.moveUp')}: ${m.name}`}
                              disabled={first}
                              onPress={() => persistOrder(moveInList(favoriteIds, m.id, -1))}
                              style={{ width: hitTarget, height: hitTarget, alignItems: 'center', justifyContent: 'center', opacity: first ? 0.3 : 1 }}
                            >
                              <ArrowUp size={20} color={colors.text} />
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`${t('stores.moveDown')}: ${m.name}`}
                              disabled={last}
                              onPress={() => persistOrder(moveInList(favoriteIds, m.id, 1))}
                              style={{ width: hitTarget, height: hitTarget, alignItems: 'center', justifyContent: 'center', opacity: last ? 0.3 : 1 }}
                            >
                              <ArrowDown size={20} color={colors.text} />
                            </Pressable>
                          </View>
                        ) : (
                          <Button
                            label={t('stores.shopNow')}
                            variant="secondary"
                            loading={busyKey === m.id}
                            onPress={() => void shop({ merchantId: m.id })}
                            style={{ minHeight: hitTarget, paddingHorizontal: spacing.md }}
                          />
                        )
                      }
                    />
                  );
                })}</Grid>
              )}

              <Text variant="caption" color="textSecondary">
                {t('stores.affiliateNote')}
              </Text>
            </>
          )}
        </View>
      </Screen>

      <Modal
        visible={modalOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setModalOpen(false)}
      >
        <SafeAreaProvider>
        <StorePickerScreen
          initial={favoriteIds}
          title={t('stores.pickStores')}
          saving={saveFavorites.isPending}
          failed={saveFavorites.isError}
          onSave={save}
          onClose={() => setModalOpen(false)}
        />
        </SafeAreaProvider>
      </Modal>
    </>
  );
}
