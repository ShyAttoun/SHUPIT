import { ActivityIndicator, Pressable, View, type PressableProps } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';

type Variant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: Variant;
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled,
  icon,
  style,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const { colors } = theme;
  const isDisabled = disabled || loading;

  const bg =
    variant === 'primary' ? colors.accent : variant === 'secondary' ? colors.surface : 'transparent';
  const fg = variant === 'primary' ? 'onAccent' : variant === 'ghost' ? 'accentText' : 'text';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={(state) => [
        {
          minHeight: 48,
          minWidth: theme.hitTarget,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.radius.md,
          backgroundColor: bg,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: theme.spacing.xs,
          opacity: isDisabled ? 0.5 : 1,
          transform: [{ scale: state.pressed && !isDisabled ? 0.97 : 1 }],
          ...(variant === 'primary' && !isDisabled ? theme.elevation(1) : {}),
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      {/* The label stays in the layout while loading, so the button never changes size. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, opacity: loading ? 0 : 1 }}>
        {icon ? <View>{icon}</View> : null}
        <Text variant="bodyStrong" color={fg}>
          {label}
        </Text>
      </View>
      {loading ? (
        <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors[fg]} />
        </View>
      ) : null}
    </Pressable>
  );
}
