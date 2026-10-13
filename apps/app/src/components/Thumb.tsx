import { useState } from 'react';
import { Image, View } from 'react-native';
import { useTheme } from '@/design';
import { MerchantLogo } from './MerchantLogo';

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
  const [failed, setFailed] = useState(false);
  if (!imageUrl || failed) return <MerchantLogo name={fallbackName} size={size} />;
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
      <Image
        source={{ uri: imageUrl }}
        accessibilityIgnoresInvertColors
        onError={() => setFailed(true)}
        style={{ width: size, height: size }}
        resizeMode="cover"
      />
    </View>
  );
}
