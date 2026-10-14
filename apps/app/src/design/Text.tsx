import type { ColorTokens, TextVariant } from '@shupit/tokens';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useTheme } from './theme';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: keyof ColorTokens;
}

export function Text({ variant = 'body', color = 'text', style, ...rest }: TextProps) {
  const theme = useTheme();
  return (
    <RNText
      // Hebrew UI: every block, including imported titles, is laid out right-to-left and aligned
      // to the right. English UI keeps per-string detection so a Hebrew title still reads RTL.
      // `dir` is a react-native-web prop that is not in RN's native typings.
      {...(({ dir: theme.isRTL ? 'rtl' : 'auto' }) as object)}
      {...rest}
      style={[
        theme.textStyle(variant),
        theme.isRTL ? { writingDirection: 'rtl', textAlign: 'right' } : null,
        { color: theme.colors[color] },
        style,
      ]}
    />
  );
}
