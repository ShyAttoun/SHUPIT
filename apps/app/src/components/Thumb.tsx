import { createElement, useEffect, useState } from 'react';
import { Image, Platform, View } from 'react-native';
import { useTheme } from '@/design';
import { auth } from '@/lib/auth';
import { MerchantLogo } from './MerchantLogo';

const BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? ''
    : 'https://shupit.vercel.app');

/**
 * Product / order picture. Many store CDNs refuse pictures requested from another site (hotlink
 * protection), so: 1) load directly without a Referer, 2) on failure fetch it through our own
 * authenticated image proxy, 3) fall back to the merchant logo.
 */
export function Thumb({
  imageUrl,
  fallbackName,
  size = 56,
}: {
  imageUrl?: string | null;
  fallbackName: string;
  size?: number;
}) {
  const { colors, radius } = useTheme();
  const [stage, setStage] = useState<'direct' | 'proxy' | 'failed'>('direct');
  const [proxied, setProxied] = useState<string | null>(null);

  useEffect(() => {
    setStage('direct');
    setProxied(null);
  }, [imageUrl]);

  useEffect(() => {
    if (stage !== 'proxy' || !imageUrl) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    void (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('no session');
        const res = await fetch(`${BASE}/api/img?u=${encodeURIComponent(imageUrl)}`, {
          headers: { authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setProxied(objectUrl);
      } catch {
        if (!cancelled) setStage('failed');
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [stage, imageUrl]);

  if (!imageUrl || stage === 'failed') return <MerchantLogo name={fallbackName} size={size} />;

  const onError = () => setStage((s) => (s === 'direct' && Platform.OS === 'web' ? 'proxy' : 'failed'));
  const src = stage === 'proxy' ? proxied : imageUrl;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.md,
        overflow: 'hidden',
        backgroundColor: colors.surfaceRaised,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {src ? (
        Platform.OS === 'web' ? (
          // A real <img> so the browser honours referrerPolicy (CSS backgrounds would not).
          createElement('img', {
            src,
            alt: '',
            referrerPolicy: 'no-referrer',
            loading: 'lazy',
            decoding: 'async',
            onError,
            style: { width: size, height: size, objectFit: 'cover', display: 'block' },
          })
        ) : (
          <Image
            source={{ uri: src }}
            accessibilityIgnoresInvertColors
            onError={onError}
            style={{ width: size, height: size }}
            resizeMode="cover"
          />
        )
      ) : null}
    </View>
  );
}
