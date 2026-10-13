import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, View } from 'react-native';
import { Button } from './Button';
import { Text } from './Text';
import { useTheme } from './theme';

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.xxl,
        paddingHorizontal: theme.spacing.lg,
      }}
    >
      {icon ? (
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: theme.radius.xl,
            backgroundColor: theme.colors.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: theme.spacing.xs,
          }}
        >
          {icon}
        </View>
      ) : null}
      <Text variant="title" style={{ textAlign: 'center' }} accessibilityRole="header">
        {title}
      </Text>
      {body ? (
        <Text color="textSecondary" style={{ textAlign: 'center', maxWidth: 360 }}>
          {body}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: theme.spacing.md }}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({
  title,
  body,
  retryLabel,
  onRetry,
}: {
  title: string;
  body?: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <EmptyState
      title={title}
      body={body}
      action={<Button variant="secondary" label={retryLabel} onPress={onRetry} />}
    />
  );
}

function SkeletonBlock({ height, width = '100%' }: { height: number; width?: number | `${number}%` }) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{
        height,
        width,
        opacity,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surface,
      }}
    />
  );
}

export function LoadingState({ rows = 4 }: { rows?: number }) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={{ gap: theme.spacing.sm, paddingVertical: theme.spacing.md }}
    >
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonBlock key={i} height={72} />
      ))}
    </View>
  );
}
