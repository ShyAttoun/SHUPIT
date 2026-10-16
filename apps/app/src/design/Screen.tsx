import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef } from 'react';
import { ScreenScrollContext } from './ScreenScroll';
import { Platform } from 'react-native';
import { useKeyboardHeight } from '@/lib/useKeyboardHeight';
import { AccessibilityInfo, Animated, ScrollView, View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './theme';

export interface ScreenProps extends ViewProps {
  scroll?: boolean;
  /** Apply the top safe-area inset (for screens without a navigation header). */
  topInset?: boolean;
}

export function Screen({ scroll = false, topInset = false, style, children, ...rest }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const scrollRef = useRef<ScrollView>(null);
  // After the keyboard has opened, scroll the focused field to a comfortable spot (Android needs this;
  // on iOS it is a harmless extra nudge).
  const ensureVisible = useMemo(
    () => (target: import('react-native').View | null) => {
      if (!target || Platform.OS === 'web') return;
      setTimeout(() => {
        const inner = (scrollRef.current as unknown as { getInnerViewRef?: () => unknown })?.getInnerViewRef?.();
        if (!inner) return;
        target.measureLayout(
          inner as never,
          (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 140), animated: true }),
          () => undefined,
        );
      }, 320);
    },
    [],
  );
  const enter = useRef(new Animated.Value(1)).current;

  // Short fade/slide each time the screen becomes the focused one (skipped with reduced motion).
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
        if (!alive || reduce) return;
        enter.setValue(0);
        Animated.timing(enter, { toValue: 1, duration: theme.motion.base, useNativeDriver: true }).start();
      });
      return () => {
        alive = false;
      };
    }, [enter, theme.motion.base]),
  );

  const content = (
    <View
      role="main"
      {...rest}
      style={[
        {
          flexGrow: 1,
          width: '100%',
          maxWidth: theme.contentMaxWidth,
          alignSelf: 'center',
          paddingHorizontal: theme.isWide ? theme.spacing.xl : theme.spacing.md,
          paddingTop: topInset ? insets.top + theme.spacing.md : theme.spacing.md,
          paddingBottom: topInset ? insets.bottom + theme.spacing.lg : theme.spacing.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  return (
    <ScreenScrollContext.Provider value={ensureVisible}>
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        opacity: enter,
        transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}
    >
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          // iOS scrolls the focused field above the keyboard by itself; Android (edge-to-edge) needs the
          // keyboard height as bottom padding so the field can be scrolled into view.
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: Platform.OS === 'android' ? Math.max(0, keyboard - insets.bottom) : 0,
          }}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          // Keyboard users must be able to scroll long, mostly-static content (e.g. legal pages).
          tabIndex={0}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </Animated.View>
    </ScreenScrollContext.Provider>
  );
}
