import { View } from 'react-native';
import { Text, useTheme } from '@/design';

/** Monogram avatar. Real merchant logos need usage rights, so none are bundled. */
export function MerchantLogo({ name, size = 44 }: { name: string; size?: number }) {
  const { colors, radius } = useTheme();
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: radius.md,
        backgroundColor: colors.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="bodyStrong" color="accentText" style={{ fontSize: size * 0.34 }}>
        {initials}
      </Text>
    </View>
  );
}
