import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, View } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';

interface ToastApi {
  show: (message: string) => void;
}
const ToastContext = createContext<ToastApi>({ show: () => {} });

export const useToast = () => useContext(ToastContext);

/** Short confirmation at the bottom of the screen. Announced politely; disappears on its own. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors, spacing, radius, elevation, motion } = useTheme();
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (m: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(m);
      Animated.timing(opacity, { toValue: 1, duration: motion.base, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: motion.base, useNativeDriver: true }).start(() =>
          setMessage(null),
        );
      }, 2400);
    },
    [opacity, motion.base],
  );
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {message ? (
        <View pointerEvents="none" style={{ position: 'absolute', start: 0, end: 0, bottom: 96, alignItems: 'center' }}>
          <Animated.View
            accessibilityLiveRegion="polite"
            role="status"
            style={{
              opacity,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radius.full,
              backgroundColor: colors.text,
              ...elevation(3),
            }}
          >
            <Text variant="label" style={{ color: colors.background }}>
              {message}
            </Text>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}
