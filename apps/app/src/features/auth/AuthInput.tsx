import { Eye, EyeOff, Lock, Mail } from 'lucide-react-native';
import { forwardRef, useRef, useState } from 'react';
import { useEnsureVisible } from '@/design/ScreenScroll';
import { Platform, Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { Text, useTheme } from '@/design';

/**
 * Rounded auth field: icon on the reading-start side, optional visibility toggle on the other side.
 * Email content is always typed left-to-right (addresses are LTR) while the field and its
 * placeholder follow the page direction.
 */
export const AuthInput = forwardRef<
  TextInput,
  TextInputProps & {
    label: string;
    kind: 'email' | 'password';
    error?: string;
    showLabel: string;
    hideLabel: string;
  }
>(function AuthInput({ label, kind, error, showLabel, hideLabel, value, style, ...rest }, ref) {
  const theme = useTheme();
  const { colors, spacing, radius, isRTL } = theme;
  const [focused, setFocused] = useState(false);
  const wrap = useRef<View>(null);
  const ensureVisible = useEnsureVisible();
  const [visible, setVisible] = useState(false);
  const Icon = kind === 'email' ? Mail : Lock;
  const filled = !!value;
  // Typed email/password text is LTR; the empty placeholder follows the page direction.
  const ltrContent = filled;
  const dir = ltrContent ? 'ltr' : isRTL ? 'rtl' : 'ltr';

  return (
    <View style={{ gap: spacing.xxs }}>
      <View
        ref={wrap}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          minHeight: 52,
          paddingHorizontal: spacing.md,
          borderRadius: radius.lg,
          borderWidth: focused ? 2 : 1,
          borderColor: error ? colors.danger : focused ? colors.accent : colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <Icon size={20} color={focused ? colors.accentText : colors.textSecondary} />
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholder={label}
          placeholderTextColor={colors.textSecondary}
          keyboardAppearance={theme.mode}
          selectionColor={colors.accent}
          underlineColorAndroid="transparent"
          value={value}
          {...({ dir } as object)}
          secureTextEntry={kind === 'password' && !visible}
          onFocus={(e) => {
            setFocused(true);
            ensureVisible(wrap.current);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          {...rest}
          style={[
            theme.textStyle('body'),
            {
              flex: 1,
              minWidth: 0,
              paddingVertical: spacing.sm,
              color: colors.text,
              textAlign:
                Platform.OS === 'web' ? (ltrContent ? 'left' : isRTL ? 'right' : 'left') : ltrContent ? 'left' : 'auto',
              // The web outline would double the border drawn by the container.
              ...({ outlineStyle: 'none' } as object),
            },
            style,
          ]}
        />
        {kind === 'password' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? hideLabel : showLabel}
            onPress={() => setVisible((v) => !v)}
            hitSlop={8}
            style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
          >
            {visible ? <EyeOff size={20} color={colors.textSecondary} /> : <Eye size={20} color={colors.textSecondary} />}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="small" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
});
