import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, View } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';

/**
 * Honest wait indicator for work whose real progress is unknown (AI reading of a screenshot or page):
 * a moving bar, the elapsed time, and a short stage message that changes the longer it takes.
 * Reduced motion: no movement, the elapsed time still updates.
 */
export function WaitProgress({
  active,
  stages,
  slowNote,
}: {
  active: boolean;
  /** Messages by elapsed seconds, e.g. [{ from: 0, text: 'Uploading…' }, { from: 3, text: 'Reading…' }]. */
  stages: { from: number; text: string }[];
  slowNote?: string;
}) {
  const { colors, spacing, radius } = useTheme();
  const [seconds, setSeconds] = useState(0);
  const [reduce, setReduce] = useState(false);
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const started = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 500);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduce(v));
    return () => {
      alive = false;
    };
  }, []);

  const barW = Math.max(60, width * 0.35);
  useEffect(() => {
    if (!active || reduce || width === 0) return;
    x.setValue(-barW);
    const loop = Animated.loop(
      Animated.timing(x, { toValue: width, duration: 1400, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [active, reduce, width, barW, x]);

  if (!active) return null;
  const stage = [...stages].reverse().find((s) => seconds >= s.from) ?? stages[0];

  return (
    <View style={{ gap: spacing.xs }} accessibilityRole="progressbar" accessibilityLabel={stage?.text}>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ height: 6, borderRadius: radius.full, backgroundColor: colors.border, overflow: 'hidden' }}
      >
        <Animated.View
          style={{
            width: reduce ? '40%' : barW,
            height: 6,
            borderRadius: radius.full,
            backgroundColor: colors.accent,
            transform: reduce ? [] : [{ translateX: x }],
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
        <Text variant="small" accessibilityLiveRegion="polite" style={{ flexShrink: 1 }}>
          {stage?.text}
        </Text>
        <Text variant="small" color="textSecondary">
          {seconds}s
        </Text>
      </View>
      {slowNote && seconds >= 25 ? (
        <Text variant="caption" color="textSecondary">
          {slowNote}
        </Text>
      ) : null}
    </View>
  );
}
