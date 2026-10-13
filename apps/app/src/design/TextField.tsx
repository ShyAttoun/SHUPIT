import { forwardRef } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';

export interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, style, ...rest },
  ref,
) {
  const theme = useTheme();
  const { colors } = theme;
  return (
    <View style={{ gap: theme.spacing.xxs }}>
      <Text variant="label" color="textSecondary">
        {label}
      </Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.textSecondary}
        {...rest}
        style={[
          theme.textStyle('body'),
          {
            minHeight: 48,
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: error ? colors.danger : colors.border,
            backgroundColor: colors.surface,
            color: colors.text,
            textAlign: 'auto',
          },
          style,
        ]}
      />
      {error ? (
        <Text variant="small" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
});
