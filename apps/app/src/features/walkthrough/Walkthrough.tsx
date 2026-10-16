import { getMerchant, merchantCatalog } from '@shupit/contracts';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Chip } from '@/components/Chip';
import { MerchantLogo } from '@/components/MerchantLogo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, LogoMark, Text, useTheme } from '@/design';
import { useAuth } from '@/features/auth/AuthProvider';
import { toggleFavoriteList, useFavoriteStores, useStoresMutations } from '@/features/stores/hooks';
import { StorePicker } from '@/features/stores/StorePicker';
import { useTranslation } from '@/i18n';
import { D, FLOATERS, Floating, IconTile, OrdersMock, StoresMock, WishlistMock } from './Mockups';
import { MIN_STORES, canFinishStores, shouldShowWalkthrough, useWalkthroughStore } from './store';

type StepKey = 'welcome' | 'wishlist' | 'orders' | 'stores';
const INTRO: StepKey[] = ['welcome', 'wishlist', 'orders'];

const glow =
  Platform.OS === 'web'
    ? ({
        backgroundImage:
          'radial-gradient(ellipse 80% 45% at 50% 18%, rgba(0,184,176,0.28), transparent 70%), radial-gradient(ellipse 70% 40% at 85% 90%, rgba(0,143,137,0.22), transparent 70%)',
      } as object)
    : {};

const merchantInfo = (id: string) => {
  const m = getMerchant(id);
  return { name: m?.name ?? id, domain: m?.domains[0] };
};

/**
 * First-run tour: three short, visual intro screens and a mandatory store selection.
 * The selection reuses StorePicker and the favorite-store persistence; the tour completes only after
 * the stores are saved. Users who already have enough favorite stores see the intro only.
 */
export function Walkthrough() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { colors, spacing, radius, isRTL } = useTheme();
  const { width: vw } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { seenFor, replaying, markSeen, closeReplay } = useWalkthroughStore();
  const favorites = useFavoriteStores();
  const { saveFavorites } = useStoresMutations();
  const [i, setI] = useState(0);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const enter = useRef(new Animated.Value(1)).current;
  const categories = useMemoCategories();

  const favoriteIds = useMemo(() => (favorites.data ?? []).map((f) => f.merchantId), [favorites.data]);
  const needsStores = replaying || favoriteIds.length < MIN_STORES;
  const steps: StepKey[] = needsStores ? [...INTRO, 'stores'] : INTRO;
  const step = steps[Math.min(i, steps.length - 1)]!;
  const last = i >= steps.length - 1;
  const picked = selected ?? favoriteIds;
  // New users cannot leave without choosing stores; a replay or an already-set-up user can.
  const canLeave = !needsStores || replaying;

  const visible = favorites.isSuccess && shouldShowWalkthrough({ uid: user?.uid, seenFor, replaying });

  const finish = useCallback(() => {
    if (user) markSeen(user.uid);
    closeReplay();
    setI(0);
    setSelected(null);
    setCategory(null);
  }, [user, markSeen, closeReplay]);

  const complete = useCallback(() => {
    const unchanged = picked.length === favoriteIds.length && picked.every((id) => favoriteIds.includes(id));
    if (unchanged && favoriteIds.length >= MIN_STORES) return finish();
    saveFavorites.mutate(picked, { onSuccess: finish });
  }, [picked, favoriteIds, saveFavorites, finish]);

  const goTo = useCallback(
    (n: number) => {
      setI(Math.max(0, Math.min(n, steps.length - 1)));
    },
    [steps.length],
  );
  const next = useCallback(() => {
    if (step === 'stores') return;
    if (last) return finish(); // intro-only tour (stores already chosen)
    goTo(i + 1);
  }, [step, last, finish, goTo, i]);
  const back = useCallback(() => goTo(i - 1), [goTo, i]);

  // Entrance: short fade/slide per screen (skipped with reduced motion).
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!alive || reduce) return;
      enter.setValue(0);
      Animated.timing(enter, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    });
    return () => {
      alive = false;
    };
  }, [i, enter]);

  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && canLeave) finish();
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') (isRTL ? back : next)();
      if (e.key === 'ArrowLeft') (isRTL ? next : back)();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, isRTL, next, back, finish, canLeave]);

  if (!visible) return null;

  const isStores = step === 'stores';
  const phoneW = Math.max(150, Math.min(210, vw * 0.5));
  const canFinish = canFinishStores(picked.length);
  const Forward = isRTL ? ChevronLeft : ChevronRight;

  const ctaLabel = isStores
    ? t('walkthrough.done')
    : i === steps.length - 1
      ? t('walkthrough.done')
      : i === INTRO.length - 1 && needsStores
        ? t('walkthrough.chooseStores')
        : t('walkthrough.next');

  const names = {
    amazon: merchantInfo('amazon'),
    shein: merchantInfo('shein'),
    aliexpress: merchantInfo('aliexpress'),
    temu: merchantInfo('temu'),
    iherb: merchantInfo('iherb'),
    asos: merchantInfo('asos'),
    zara: merchantInfo('zara'),
    hm: merchantInfo('hm'),
    nike: merchantInfo('nike'),
    adidas: merchantInfo('adidas'),
    ikea: merchantInfo('ikea'),
    ebay: merchantInfo('ebay'),
  };

  return (
    <View
      style={[StyleSheet.absoluteFill, { zIndex: 1000, backgroundColor: D.bg, alignItems: 'center', overflow: 'hidden' }, glow]}
      role="dialog"
      aria-modal
      aria-label={t('walkthrough.title')}
    >
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 520,
          paddingHorizontal: spacing.md,
          paddingTop: Math.max(insets.top, spacing.md),
          paddingBottom: insets.bottom,
        }}
      >
        {/* top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
          <Text variant="label" style={{ color: D.muted }}>
            {`\u2066${Math.min(i + 1, steps.length)} / ${steps.length}\u2069`}
          </Text>
          <LogoMark size={26} color={D.accent} />
          {canLeave ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              onPress={finish}
              style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={20} color={D.muted} />
            </Pressable>
          ) : !isStores ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('walkthrough.skip')}
              onPress={() => goTo(steps.length - 1)}
              style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text variant="label" style={{ color: D.muted }}>
                {t('walkthrough.skip')}
              </Text>
            </Pressable>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>

        <Animated.View
          style={{
            flex: 1,
            opacity: enter,
            transform: [{ translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [isRTL ? -24 : 24, 0] }) }],
          }}
        >
          <Text
            variant="display"
            accessibilityRole="header"
            style={{ color: D.text, textAlign: 'center', marginTop: spacing.sm }}
          >
            {t(`walkthrough.${step}.title`)}
          </Text>
          <Text numberOfLines={2} style={{ color: D.muted, textAlign: 'center', marginTop: spacing.xs }}>
            {t(`walkthrough.${step}.body`)}
          </Text>

          {!isStores ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md }}>
              <View style={{ width: phoneW + 120, alignItems: 'center', justifyContent: 'center' }}>
                {step === 'welcome' ? <StoresMock width={phoneW} names={names} /> : null}
                {step === 'wishlist' ? (
                  <WishlistMock width={phoneW} merchants={[names.nike, names.amazon, names.zara, names.iherb]} />
                ) : null}
                {step === 'orders' ? <OrdersMock width={phoneW} names={names} /> : null}

                {/* floating, decorative elements */}
                {step === 'welcome' ? (
                  <>
                    <Floating style={{ top: 10, start: 0 }} phase={0}>
                      <View style={{ transform: [{ rotate: '-8deg' }] }}>
                        <LogoTile id="amazon" />
                      </View>
                    </Floating>
                    <Floating style={{ top: 120, end: 0 }} phase={500}>
                      <LogoTile id="hm" />
                    </Floating>
                    <Floating style={{ bottom: 40, start: 4 }} phase={900}>
                      <IconTile Icon={FLOATERS.ShoppingBag} />
                    </Floating>
                  </>
                ) : null}
                {step === 'wishlist' ? (
                  <>
                    <Floating style={{ top: 20, end: 0 }} phase={0}>
                      <IconTile Icon={FLOATERS.Heart} color="#FF6B8A" />
                    </Floating>
                    <Floating style={{ bottom: 70, start: 0 }} phase={600}>
                      <IconTile Icon={FLOATERS.Heart} />
                    </Floating>
                  </>
                ) : null}
                {step === 'orders' ? (
                  <>
                    <Floating style={{ top: 10, start: 0 }} phase={0}>
                      <IconTile Icon={FLOATERS.Package} color="#E8B26A" />
                    </Floating>
                    <Floating style={{ bottom: 60, end: 0 }} phase={700}>
                      <IconTile Icon={FLOATERS.Truck} />
                    </Floating>
                  </>
                ) : null}
              </View>
              <Text variant="caption" style={{ color: D.muted, opacity: 0.8 }}>
                {t('walkthrough.example')}
              </Text>
            </View>
          ) : (
            <View
              style={{
                flex: 1,
                marginTop: spacing.md,
                borderRadius: radius.xl,
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: 'hidden',
              }}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flexGrow: 0 }}
                contentContainerStyle={{ gap: spacing.xs, padding: spacing.sm, flexDirection: 'row' }}
              >
                <Chip label={t('walkthrough.cat.all')} selected={category === null} onPress={() => setCategory(null)} />
                {categories.map((c) => (
                  <Chip key={c} label={t(`walkthrough.cat.${c}`)} selected={category === c} onPress={() => setCategory(c)} />
                ))}
              </ScrollView>
              <ScrollView contentContainerStyle={{ padding: spacing.sm }} keyboardShouldPersistTaps="handled">
                <StorePicker
                  selected={picked}
                  category={category}
                  onToggle={(id) => setSelected(toggleFavoriteList(picked, id))}
                />
              </ScrollView>
            </View>
          )}
        </Animated.View>

        {/* footer */}
        <View style={{ paddingVertical: spacing.md, gap: spacing.sm }}>
          {isStores ? (
            <Text
              variant="small"
              accessibilityLiveRegion="polite"
              style={{
                textAlign: 'center',
                color: saveFavorites.isError ? '#F97066' : canFinish ? '#47CD89' : D.muted,
              }}
            >
              {saveFavorites.isError
                ? t('common.saveFailed')
                : t('walkthrough.counter', { count: picked.length, min: MIN_STORES })}
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }} accessibilityElementsHidden>
              {steps.map((s, n) => (
                <View
                  key={s}
                  style={{
                    width: n === i ? 22 : 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: n === i ? D.accent : D.border,
                  }}
                />
              ))}
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {i > 0 ? <Button variant="secondary" label={t('common.back')} onPress={back} /> : null}
            <Button
              style={{ flex: 1 }}
              label={ctaLabel}
              disabled={isStores && !canFinish}
              loading={isStores && saveFavorites.isPending}
              icon={isStores || (last && !needsStores) ? undefined : <Forward size={18} color={colors.onAccent} />}
              onPress={isStores ? complete : next}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function LogoTile({ id }: { id: string }) {
  const m = merchantInfo(id);
  return (
    <View style={{ shadowColor: D.accent, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }}>
      <MerchantLogo name={m.name} domain={m.domain} size={56} />
    </View>
  );
}


/** Categories that actually exist in the catalog, in a stable order. */
function useMemoCategories(): string[] {
  return useMemo(() => {
    const order = ['fashion', 'electronics', 'appliances', 'home', 'sports', 'beauty', 'health', 'baby', 'books', 'toys', 'general'];
    const have = new Set(merchantCatalog.map((m) => m.category).filter(Boolean) as string[]);
    return order.filter((c) => have.has(c));
  }, []);
}
