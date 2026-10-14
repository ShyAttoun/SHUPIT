import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { useTheme } from './theme';

/** The subset of the tab-bar props used here (the navigation package's types are not importable). */
interface NavProps {
  state: { index: number; routes: { key: string; name: string; params?: object }[] };
  descriptors: Record<
    string,
    {
      options: {
        title?: string;
        tabBarIcon?: (p: { focused: boolean; color: string; size: number }) => React.ReactNode;
      };
    }
  >;
  navigation: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    emit: (e: any) => unknown;
    navigate: (name: string, params?: object) => void;
  };
}

/**
 * One navigation component for every screen size: a bottom bar on phones/tablets and a side rail on
 * laptops and desktops. The rail sits on the reading-start edge (right in Hebrew).
 */
export function AppNav({ state, descriptors, navigation }: NavProps) {
  const { colors, spacing, radius, isWide, hitTarget, elevation } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      role="tablist"
      style={[
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
        },
        isWide
          ? {
              width: 232,
              paddingTop: spacing.md,
              paddingHorizontal: spacing.sm,
              gap: spacing.xxs,
              borderEndWidth: 1,
            }
          : {
              flexDirection: 'row',
              borderTopWidth: 1,
              paddingTop: spacing.xs,
              paddingBottom: spacing.xs + insets.bottom,
              paddingHorizontal: spacing.xs,
              ...elevation(1),
            },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key]!;
        const focused = state.index === index;
        const label = (options.title ?? route.name) as string;
        const color = focused ? colors.accentText : colors.textSecondary;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true }) as {
            defaultPrevented?: boolean;
          };
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={onPress}
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
              {
                minHeight: hitTarget + 8,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.md,
                gap: 2,
                backgroundColor: focused
                  ? colors.accentSoft
                  : hovered || pressed
                    ? colors.surface
                    : 'transparent',
              },
              isWide
                ? { flexDirection: 'row', justifyContent: 'flex-start', paddingHorizontal: spacing.md, gap: spacing.sm }
                : { flex: 1, paddingVertical: 6 },
            ]}
          >
            {options.tabBarIcon?.({ focused, color, size: 22 })}
            <Text variant={isWide ? 'bodyStrong' : 'caption'} style={{ color }} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
