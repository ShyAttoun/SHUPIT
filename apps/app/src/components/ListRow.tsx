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
  /** Secondary action shown inside the same box, under the content (outside the row's press target). */
  footer?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const { colors, spacing, radius, hitTarget } = useTheme();
  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        minHeight: hitTarget + 16,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
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
  // One card: the tappable content, and (optionally) a footer action inside the same box.
  return (
    <View
      style={{
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
      }}
    >
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? title}
          onPress={onPress}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
          {content}
        </Pressable>
      ) : (
        content
      )}
      {footer ? (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            paddingHorizontal: spacing.sm,
            paddingBottom: spacing.sm,
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}
