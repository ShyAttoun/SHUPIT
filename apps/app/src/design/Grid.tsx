import { Children, type ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme } from './theme';

/** Single column on phones; 2 columns on tablets/laptops and 3 on large desktops. */
export function Grid({ children, min = 1 }: { children: ReactNode; min?: number }) {
  const { breakpoint, spacing } = useTheme();
  const cols = Math.max(min, breakpoint === 'phone' ? 1 : breakpoint === 'desktop' ? 3 : 2);
  const items = Children.toArray(children);
  if (cols === 1) return <View style={{ gap: spacing.sm }}>{items}</View>;
  const gap = spacing.sm;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {items.map((child, i) => (
        <View key={i} style={{ flexBasis: `calc(${100 / cols}% - ${(gap * (cols - 1)) / cols}px)` as never, flexGrow: 1, maxWidth: '100%' }}>
          {child}
        </View>
      ))}
    </View>
  );
}
