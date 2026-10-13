import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from './theme';

/**
 * Flat SHUPIT smile mark. Geometry from the brand vector concept
 * (SHUPIT_icon_vector_concept.svg), without the app-icon background.
 */
export function LogoMark({ size = 32, color }: { size?: number; color?: string }) {
  const { colors } = useTheme();
  const fill = color ?? colors.accent;
  return (
    <Svg
      width={size}
      height={size * (360 / 390)}
      viewBox="80 55 390 360"
      accessibilityRole="image"
      accessibilityLabel="SHUPIT"
    >
      <Path
        d="M122 183 C127 350 383 350 389 183"
        fill="none"
        stroke={fill}
        strokeWidth={65}
        strokeLinecap="round"
      />
      <Circle cx={195} cy={373} r={28} fill={fill} />
      <Circle cx={322} cy={373} r={28} fill={fill} />
      <Path
        d="M366 108 L379 74 M415 143 L450 124 M326 106 L316 73"
        fill="none"
        stroke={fill}
        strokeWidth={18}
        strokeLinecap="round"
      />
    </Svg>
  );
}
