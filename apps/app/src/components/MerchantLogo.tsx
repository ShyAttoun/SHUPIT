import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { merchantLogoUrl } from '@shupit/contracts';
import { Text, useTheme } from '@/design';

const MIN_ICON_PX = 32;

/**
 * App-icon style tile. Uses the merchant's own site icon when it is sharp
 * enough, otherwise a monogram. Merchant icons are their trademarks and are
 * shown only to identify the store.
 */
export function MerchantLogo({
  name,
  domain,
  size = 44,
}: {
  name: string;
  domain?: string;
  size?: number;
}) {
  const { colors, radius } = useTheme();
  const url = domain ? merchantLogoUrl(domain, 128) : null;
  const [useIcon, setUseIcon] = useState(!!url);

  // Probe the real pixel size once (onLoad events don't carry dimensions on web).
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    Image.getSize(
      url,
      (w, h) => {
        if (!cancelled && Math.min(w, h) < MIN_ICON_PX) setUseIcon(false);
      },
      () => {
        if (!cancelled) setUseIcon(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [url]);

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  const corner = Math.round(size * 0.24) || radius.md;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: corner,
        backgroundColor: useIcon ? '#FFFFFF' : colors.accentSoft,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {useIcon && url ? (
        <Image
          source={{ uri: url }}
          accessibilityIgnoresInvertColors
          onError={() => setUseIcon(false)}
          style={{ width: size * 0.62, height: size * 0.62 }}
          resizeMode="contain"
        />
      ) : (
        <Text variant="bodyStrong" color="accentText" style={{ fontSize: size * 0.34 }}>
          {initials}
        </Text>
      )}
    </View>
  );
}
