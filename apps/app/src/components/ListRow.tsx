import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Text, useTheme } from '@/design';

export function ListRow({
  leading,
  title,
  subtitle,
  meta,
  trailing,
  footer,
  onPress,
  accessibilityLabel,
}: {
  leading?: ReactNode;
  title: string;
  subtitle?: string | null;
  meta?: ReactNode;
  trailing?: ReactNode;
  /** Secondary action shown under the row (outside the row's own press target). */
  footer?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const { colors, spacing, radius, hitTarget } = useTheme();
  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        minHeight: hitTarget + 16,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="small" color="textSecondary" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {meta}
      </View>
      {trailing}
    </View>
  );
  const row = onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      {body}
    </Pressable>
  ) : (
    body
  );
  if (!footer) return row;
  return (
    <View style={{ gap: spacing.xs }}>
      {row}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>{footer}</View>
    </View>
  );
}
