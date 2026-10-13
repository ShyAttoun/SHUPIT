import Svg, { Circle, Polyline } from 'react-native-svg';
import { View } from 'react-native';
import { Text, useTheme } from '@/design';

export interface ChartPoint {
  t: number; // epoch ms
  v: number; // value in major units
}

/** Pure scaling so the chart can be unit-tested. Returns null with fewer than 2 points. */
export function chartGeometry(
  points: ChartPoint[],
  width: number,
  height: number,
  pad = 8,
): { xy: { x: number; y: number }[]; min: number; max: number } | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const ts = sorted.map((p) => p.t);
  const vs = sorted.map((p) => p.v);
  const [t0, t1] = [Math.min(...ts), Math.max(...ts)];
  const [min, max] = [Math.min(...vs), Math.max(...vs)];
  const spanT = t1 - t0 || 1;
  const spanV = max - min || 1;
  const xy = sorted.map((p) => ({
    x: pad + ((p.t - t0) / spanT) * (width - pad * 2),
    y: height - pad - ((p.v - min) / spanV) * (height - pad * 2),
  }));
  return { xy, min, max };
}

export function PriceChart({
  points,
  emptyLabel,
  minLabel,
  maxLabel,
  height = 120,
}: {
  points: ChartPoint[];
  emptyLabel: string;
  minLabel: string;
  maxLabel: string;
  height?: number;
}) {
  const { colors, spacing, radius } = useTheme();
  const width = 320;
  const geo = chartGeometry(points, width, height);

  if (!geo) {
    return (
      <View style={{ padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface }}>
        <Text color="textSecondary" variant="small">
          {emptyLabel}
        </Text>
      </View>
    );
  }
  const last = geo.xy[geo.xy.length - 1]!;
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ borderRadius: radius.md, backgroundColor: colors.surface, padding: spacing.xs }}>
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <Polyline
            points={geo.xy.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={colors.accentStrong}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <Circle cx={last.x} cy={last.y} r={4} fill={colors.accent} />
        </Svg>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" color="textSecondary">
          {minLabel}
        </Text>
        <Text variant="caption" color="textSecondary">
          {maxLabel}
        </Text>
      </View>
    </View>
  );
}
