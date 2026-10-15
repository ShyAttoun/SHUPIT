import { useEffect, useRef } from 'react';
import { Animated, Pressable } from 'react-native';
import { useTheme } from './theme';

const W = 52;
const H = 30;
const KNOB = 24;
const PAD = 3;

/**
 * Switch with the knob always inside its track, in both reading directions.
 * (The platform switch positions its knob wrongly when the page is right-to-left.)
 */
export function Toggle({
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  /** Accepted for drop-in use; the track colours come from the theme. */
  trackColor?: unknown;
}) {
  const { colors, isRTL, motion } = useTheme();
  const x = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(x, { toValue: value ? 1 : 0, duration: motion.fast, useNativeDriver: true }).start();
  }, [value, x, motion.fast]);

  const travel = W - KNOB - PAD * 2;
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: isRTL ? [0, -travel] : [0, travel] });

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      aria-checked={value}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={8}
      style={{
        width: W,
        height: H,
        borderRadius: H / 2,
        backgroundColor: value ? colors.accent : colors.border,
        justifyContent: 'center',
        // Start edge in the current direction: left in LTR, right in RTL.
        alignItems: 'flex-start',
        paddingHorizontal: PAD,
        opacity: disabled ? 0.5 : 1,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{
          width: KNOB,
          height: KNOB,
          borderRadius: KNOB / 2,
          backgroundColor: '#FFFFFF',
          transform: [{ translateX }],
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 2,
          shadowOffset: { width: 0, height: 1 },
        }}
      />
    </Pressable>
  );
}
