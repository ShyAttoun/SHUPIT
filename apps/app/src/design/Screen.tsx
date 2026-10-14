import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
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
          paddingBottom: theme.spacing.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  return (
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
          contentContainerStyle={{ flexGrow: 1 }}
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
  );
}
