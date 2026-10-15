import type { SavedProduct } from '@shupit/contracts';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, ScrollView, View } from 'react-native';
import { Thumb } from '@/components/Thumb';
import { Text, useTheme } from '@/design';
import { useAppLanguage } from '@/i18n';
import { formatPrice } from '@/lib/format';

const CARD = 148;
const GAP = 12;
const INTERVAL_MS = 3500;

/** Horizontally moving strip of saved products. Auto-advances unless the user prefers reduced motion. */
export function WishlistCarousel({
  products,
  onOpen,
}: {
  products: SavedProduct[];
  onOpen: (p: SavedProduct) => void;
}) {
  const { language } = useAppLanguage();
  const { colors, spacing, radius, isRTL } = useTheme();
  const ref = useRef<ScrollView>(null);
  const index = useRef(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduceMotion(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const moving = !paused && !reduceMotion && products.length > 1;
  useEffect(() => {
    if (!moving) return;
    const timer = setInterval(() => {
      index.current = (index.current + 1) % products.length;
      ref.current?.scrollTo({ x: index.current * (CARD + GAP), animated: true });
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [moving, products.length]);

  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      onTouchStart={() => setPaused(true)}
      {...(Platform.OS === 'web'
        ? ({ onMouseEnter: () => setPaused(true), onMouseLeave: () => setPaused(false), onFocus: () => setPaused(true) } as object)
        : {})}
      onMomentumScrollEnd={(e) => {
        index.current = Math.round(e.nativeEvent.contentOffset.x / (CARD + GAP));
      }}
      contentContainerStyle={{ gap: GAP, paddingVertical: spacing.xs, flexDirection: 'row' }}
      accessibilityLabel="carousel"
    >
      {products.map((p) => {
        const price = formatPrice(p.savedPrice, language);
        return (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={p.title}
            onPress={() => onOpen(p)}
            style={({ pressed }) => ({
              width: CARD,
              gap: spacing.xs,
              padding: spacing.xs,
              borderRadius: radius.lg,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View style={{ alignItems: 'center' }}>
              <Thumb imageUrl={p.thumbDataUrl ?? p.imageUrl} fallbackName={p.title} size={CARD - 24} />
            </View>
            <Text variant="small" numberOfLines={2}>
              {p.title}
            </Text>
            {price ? (
              <Text variant="caption" color="textSecondary">
                {price}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
