import { Pressable } from 'react-native';
import { Text, useTheme } from '@/design';

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const { colors, spacing, radius, hitTarget } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={{
        minHeight: hitTarget - 4,
        paddingHorizontal: spacing.md,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? colors.accentSoft : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.border,
      }}
    >
      <Text variant="label" color={selected ? 'accentText' : 'text'}>
        {label}
      </Text>
    </Pressable>
  );
}
