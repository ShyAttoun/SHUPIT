import { Headphones, Heart, Package, ShoppingBag, Truck, Watch, Footprints, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, View } from 'react-native';
import { MerchantLogo } from '@/components/MerchantLogo';
import { Text } from '@/design';
import { useTranslation } from '@/i18n';

/** The onboarding is always dark and cinematic, whatever theme the app uses. */
export const D = {
  bg: '#071625',
  panel: '#0C2036',
  surface: '#112A44',
  border: '#1D3A57',
  text: '#F4F8FB',
  muted: '#8FA6BA',
  accent: '#00B8B0',
  accentSoft: '#0B3A40',
};

/** Slow float, off with reduced motion. */
export function useFloat(phase = 0, distance = 7) {
  const v = useRef(new Animated.Value(0)).current;
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((r) => alive && setReduce(r));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (reduce) return;
    const timer = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: 2400, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 2400, useNativeDriver: true }),
        ]),
      ).start();
    }, phase);
    return () => {
      clearTimeout(timer);
      v.stopAnimation();
    };
  }, [reduce, phase, v]);
  return v.interpolate({ inputRange: [0, 1], outputRange: [0, -distance] });
}

export function Floating({
  children,
  style,
  phase,
}: {
  children: ReactNode;
  style: object;
  phase?: number;
}) {
  const y = useFloat(phase);
  return <Animated.View style={[{ position: 'absolute', transform: [{ translateY: y }] }, style]}>{children}</Animated.View>;
}

export function IconTile({ Icon, color = D.accent, size = 52 }: { Icon: LucideIcon; color?: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: D.surface,
        borderWidth: 1,
        borderColor: D.border,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: color,
        shadowOpacity: 0.35,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
      }}
    >
      <Icon size={size * 0.5} color={color} />
    </View>
  );
}

export function PhoneFrame({ width, children }: { width: number; children: ReactNode }) {
  const height = width * 1.9;
  return (
    <View
      style={{
        width,
        height,
        borderRadius: width * 0.14,
        padding: 6,
        backgroundColor: '#0B1522',
        borderWidth: 2,
        borderColor: '#2A4766',
        shadowColor: D.accent,
        shadowOpacity: 0.3,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: 12 },
      }}
    >
      <View style={{ flex: 1, borderRadius: width * 0.11, overflow: 'hidden', backgroundColor: D.bg }}>
        <View style={{ alignSelf: 'center', width: width * 0.3, height: 10, borderRadius: 5, backgroundColor: '#0B1522', marginTop: 6 }} />
        {children}
      </View>
    </View>
  );
}

function ScreenHeader({ title }: { title: string }) {
  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 }}>
      <Text variant="bodyStrong" style={{ color: D.text, textAlign: 'center' }}>
        {title}
      </Text>
    </View>
  );
}

const STORE_GRID = ['amazon', 'shein', 'aliexpress', 'temu', 'iherb', 'asos', 'zara', 'hm', 'nike', 'adidas', 'ikea', 'ebay'];

export function StoresMock({ width, names }: { width: number; names: Record<string, { name: string; domain?: string }> }) {
  const { t } = useTranslation();
  const tile = (width - 12 - 8 * 2 - 8 * 3) / 3;
  return (
    <PhoneFrame width={width}>
      <ScreenHeader title={t('tabs.stores')} />
      <View style={{ marginHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: D.panel, borderWidth: 1, borderColor: D.border, marginBottom: 8 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, gap: 8 }}>
        {STORE_GRID.map((id) => (
          <MerchantLogo key={id} name={names[id]?.name ?? id} domain={names[id]?.domain} size={tile} />
        ))}
      </View>
    </PhoneFrame>
  );
}

const PRODUCT_ICONS: LucideIcon[] = [Footprints, Headphones, ShoppingBag, Watch];

export function WishlistMock({ width, merchants }: { width: number; merchants: { name: string; domain?: string }[] }) {
  const { t } = useTranslation();
  const card = Math.floor((width - 12 - 4 - 16 - 10) / 2);
  return (
    <PhoneFrame width={width}>
      <ScreenHeader title={t('tabs.wishlist')} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, gap: 10 }}>
        {PRODUCT_ICONS.map((Icon, i) => (
          <View
            key={i}
            style={{
              width: card,
              borderRadius: 14,
              backgroundColor: D.panel,
              borderWidth: 1,
              borderColor: D.border,
              padding: 6,
              gap: 6,
            }}
          >
            <View style={{ height: card * 0.7, borderRadius: 10, backgroundColor: D.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={card * 0.34} color={D.muted} />
              <View style={{ position: 'absolute', top: 6, end: 6 }}>
                <Heart size={14} color="#FF6B8A" fill="#FF6B8A" />
              </View>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: D.border, width: '80%' }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MerchantLogo name={merchants[i]?.name ?? ''} domain={merchants[i]?.domain} size={18} />
              <View style={{ height: 5, borderRadius: 3, backgroundColor: D.border, width: '40%' }} />
            </View>
          </View>
        ))}
      </View>
    </PhoneFrame>
  );
}

const ORDER_ROWS: { merchant: string; stage: 0 | 1 | 2 | 3; status: 'processing' | 'in_transit' | 'ready_for_pickup' | 'delivered' }[] = [
  { merchant: 'shein', stage: 1, status: 'in_transit' },
  { merchant: 'aliexpress', stage: 3, status: 'delivered' },
  { merchant: 'amazon', stage: 0, status: 'processing' },
];

export function OrdersMock({ width, names }: { width: number; names: Record<string, { name: string; domain?: string }> }) {
  const { t } = useTranslation();
  return (
    <PhoneFrame width={width}>
      <ScreenHeader title={t('tabs.orders')} />
      <View style={{ paddingHorizontal: 8, gap: 8 }}>
        {ORDER_ROWS.map((o) => (
          <View key={o.merchant} style={{ borderRadius: 14, backgroundColor: D.panel, borderWidth: 1, borderColor: D.border, padding: 8, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MerchantLogo name={names[o.merchant]?.name ?? o.merchant} domain={names[o.merchant]?.domain} size={30} />
              <View style={{ flex: 1, gap: 5 }}>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: D.border, width: '70%' }} />
                <View style={{ height: 5, borderRadius: 3, backgroundColor: D.border, width: '40%' }} />
              </View>
              <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, backgroundColor: D.accentSoft }}>
                <Text variant="caption" style={{ color: D.accent, fontSize: 9, lineHeight: 12 }}>
                  {t(`orders.status.${o.status}`)}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 3 }}>
              {[0, 1, 2, 3].map((n) => (
                <View key={n} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: n <= o.stage ? D.accent : D.border }} />
              ))}
            </View>
          </View>
        ))}
      </View>
    </PhoneFrame>
  );
}

export const FLOATERS = { Package, Truck, Heart, ShoppingBag };
