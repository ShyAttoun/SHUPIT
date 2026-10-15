import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text, useTheme } from '@/design';

/** One colour identity per category, so neighbouring sections read as clearly different. */
export type SectionTone = 'liked' | 'coupons' | 'shipments' | 'orders' | 'actions' | 'alerts' | 'drops';

const TONES: Record<SectionTone, { light: [string, string]; dark: [string, string] }> = {
  // [accent bar, soft header background]
  liked: { light: ['#E5446D', '#FDECF1'], dark: ['#FF6B8A', '#3A1824'] },
  coupons: { light: ['#D97706', '#FEF3C7'], dark: ['#FBBF24', '#3A2A0A'] },
  shipments: { light: ['#2563EB', '#E8F0FE'], dark: ['#60A5FA', '#12233F'] },
  orders: { light: ['#7C3AED', '#F1EAFE'], dark: ['#A78BFA', '#251A40'] },
  actions: { light: ['#00B8B0', '#E7FAF8'], dark: ['#00B8B0', '#0B2F36'] },
  alerts: { light: ['#EA580C', '#FFEDD5'], dark: ['#FB923C', '#3A1D0B'] },
  drops: { light: ['#16A34A', '#E7F7EC'], dark: ['#4ADE80', '#0F2A1A'] },
};

/** A bounded panel with its own coloured header, so neighbouring sections read as separate categories. */
export function Section({
  title,
  action,
  tone = 'actions',
  children,
}: {
  title: string;
  action?: ReactNode;
  tone?: SectionTone;
  children: ReactNode;
}) {
  const { spacing, radius, colors, elevation, mode } = useTheme();
  const [bar, soft] = TONES[tone][mode];
  return (
    <View
      style={{
        // Fills its grid cell, so boxes in the same row end at the same height.
        flexGrow: 1,
        borderRadius: radius.xl,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        ...elevation(1),
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.sm,
          // One fixed header height for every category, with or without an action button.
          height: 56,
          paddingHorizontal: spacing.md,
          backgroundColor: soft,
          borderBottomWidth: 3,
          borderBottomColor: bar,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 }}>
          <View style={{ width: 6, height: 22, borderRadius: 3, backgroundColor: bar }} />
          <Text variant="headline" accessibilityRole="header" numberOfLines={1}>
            {title}
          </Text>
        </View>
        {action}
      </View>
      <View style={{ gap: spacing.sm, padding: spacing.md }}>{children}</View>
    </View>
  );
}
