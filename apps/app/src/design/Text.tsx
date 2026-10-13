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
      {...rest}
      style={[theme.textStyle(variant), { color: theme.colors[color] }, style]}
    />
  );
}
