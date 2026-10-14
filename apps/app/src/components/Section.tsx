import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text, useTheme } from '@/design';

/** A bounded panel with its own header, so neighbouring sections read as separate categories. */
export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const { spacing, radius, colors, elevation } = useTheme();
  return (
    <View
      style={{
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.xl,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        ...elevation(1),
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.sm,
          paddingBottom: spacing.xs,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 }}>
          <View style={{ width: 4, height: 20, borderRadius: 2, backgroundColor: colors.accent }} />
          <Text variant="headline" accessibilityRole="header" numberOfLines={1}>
            {title}
          </Text>
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}
