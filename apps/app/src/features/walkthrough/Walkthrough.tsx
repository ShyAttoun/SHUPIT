import { ChevronLeft, ChevronRight, Heart, Package, ShoppingBag, Store, X, type LucideIcon } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, LogoMark, Text, useTheme } from '@/design';
import { useAuth } from '@/features/auth/AuthProvider';
import { toggleFavoriteList, useFavoriteStores, useStoresMutations } from '@/features/stores/hooks';
import { StorePicker } from '@/features/stores/StorePicker';
import { useTranslation } from '@/i18n';
import { MIN_STORES, canFinishStores, shouldShowWalkthrough, useWalkthroughStore } from './store';

type StepKey = 'welcome' | 'wishlist' | 'orders' | 'stores';

const INTRO: { key: StepKey; Icon: LucideIcon }[] = [
  { key: 'welcome', Icon: ShoppingBag },
  { key: 'wishlist', Icon: Heart },
  { key: 'orders', Icon: Package },
];

/**
 * First-run tour: three short intro steps and a store selection. The selection reuses the app's
 * StorePicker and favorite-store persistence; the tour completes only after the stores are saved.
 * Users who already have enough favorite stores see the intro only. Reopenable from Settings.
 */
export function Walkthrough() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { colors, spacing, radius, isRTL, isWide, elevation } = useTheme();
  const { seenFor, replaying, markSeen, closeReplay } = useWalkthroughStore();
  const favorites = useFavoriteStores();
  const { saveFavorites } = useStoresMutations();
  const [i, setI] = useState(0);
  const [selected, setSelected] = useState<string[] | null>(null);

  const favoriteIds = useMemo(() => (favorites.data ?? []).map((f) => f.merchantId), [favorites.data]);
  const needsStores = replaying || favoriteIds.length < MIN_STORES;
  const steps: { key: StepKey; Icon: LucideIcon }[] = needsStores
    ? [...INTRO, { key: 'stores', Icon: Store }]
    : INTRO;
  const step = steps[Math.min(i, steps.length - 1)]!;
  const last = i >= steps.length - 1;
  const picked = selected ?? favoriteIds;

  const visible =
    favorites.isSuccess && shouldShowWalkthrough({ uid: user?.uid, seenFor, replaying });

  const finish = useCallback(() => {
    if (user) markSeen(user.uid);
    closeReplay();
    setI(0);
    setSelected(null);
  }, [user, markSeen, closeReplay]);

  // Closing early skips the tour (remembered per user; it can be replayed from Settings). Nothing is saved.
  const dismiss = finish;

  const complete = useCallback(() => {
    const unchanged =
      picked.length === favoriteIds.length && picked.every((id) => favoriteIds.includes(id));
    if (unchanged && favoriteIds.length >= MIN_STORES) return finish();
    saveFavorites.mutate(picked, { onSuccess: finish });
  }, [picked, favoriteIds, saveFavorites, finish]);

  const next = useCallback(() => {
    if (step.key === 'stores') return; // the final CTA is the only way forward
    if (last) return finish();
    setI((v) => v + 1);
  }, [step.key, last, finish]);
  const back = useCallback(() => setI((v) => Math.max(0, v - 1)), []);

  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') (isRTL ? back : next)();
      if (e.key === 'ArrowLeft') (isRTL ? next : back)();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, isRTL, next, back, dismiss]);

  if (!visible) return null;
  const Icon = step.Icon;
  const Forward = isRTL ? ChevronLeft : ChevronRight;
  const isStores = step.key === 'stores';
  const canFinish = canFinishStores(picked.length);

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        { zIndex: 1000, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
      ]}
    >
      <View style={{ width: '100%', alignItems: 'center', maxHeight: '100%' }}>
        <View
          role="dialog"
          aria-modal
          aria-label={t('walkthrough.title')}
          style={{
            width: '100%',
            maxWidth: isWide ? 600 : 480,
            maxHeight: '94%',
            borderRadius: radius.xl,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
            ...elevation(3),
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: spacing.md,
              paddingTop: spacing.sm,
            }}
          >
            <LogoMark size={28} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              onPress={dismiss}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
            {!isStores ? (
              <View
                style={{
                  alignSelf: 'center',
                  width: 104,
                  height: 104,
                  borderRadius: 34,
                  backgroundColor: colors.accentSoft,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={48} color={colors.accentText} />
              </View>
            ) : null}

            <Text variant="title" accessibilityRole="header" style={{ textAlign: 'center' }}>
              {t(`walkthrough.${step.key}.title`)}
            </Text>
            <Text color="textSecondary" numberOfLines={2} style={{ textAlign: 'center' }}>
              {t(`walkthrough.${step.key}.body`)}
            </Text>

            {isStores ? (
              <StorePicker selected={picked} onToggle={(id) => setSelected(toggleFavoriteList(picked, id))} />
            ) : null}
          </ScrollView>

          <View style={{ gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
            {isStores ? (
              <Text
                variant="small"
                color={saveFavorites.isError ? 'danger' : canFinish ? 'success' : 'textSecondary'}
                accessibilityLiveRegion="polite"
                style={{ textAlign: 'center' }}
              >
                {saveFavorites.isError
                  ? t('common.saveFailed')
                  : t('walkthrough.counter', { count: picked.length, min: MIN_STORES })}
              </Text>
            ) : (
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }} accessibilityElementsHidden>
                {steps.map((s, n) => (
                  <View
                    key={s.key}
                    style={{
                      width: n === i ? 22 : 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: n === i ? colors.accent : colors.border,
                    }}
                  />
                ))}
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {i > 0 ? <Button variant="secondary" label={t('common.back')} onPress={back} /> : null}
              {isStores ? (
                <Button
                  style={{ flex: 1 }}
                  label={t('walkthrough.done')}
                  disabled={!canFinish}
                  loading={saveFavorites.isPending}
                  onPress={complete}
                />
              ) : (
                <Button
                  style={{ flex: 1 }}
                  label={last ? t('walkthrough.done') : t('walkthrough.next')}
                  icon={last ? undefined : <Forward size={18} color={colors.onAccent} />}
                  onPress={next}
                />
              )}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
