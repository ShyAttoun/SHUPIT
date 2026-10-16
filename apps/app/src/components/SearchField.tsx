import { Search } from 'lucide-react-native';
import { Platform, TextInput, View } from 'react-native';
import { useTheme } from '@/design';

export function SearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
}) {
  const theme = useTheme();
  const { colors } = theme;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        minHeight: 48,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Search size={18} color={colors.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        accessibilityLabel={placeholder}
        {...(({ dir: theme.isRTL ? 'rtl' : 'auto' }) as object)}
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        keyboardAppearance={theme.mode}
        selectionColor={colors.accent}
        clearButtonMode="while-editing"
        enablesReturnKeyAutomatically
        underlineColorAndroid="transparent"
        style={[theme.textStyle('body'), { flex: 1, color: colors.text, paddingVertical: 10, textAlign: Platform.OS === 'web' && theme.isRTL ? 'right' : 'auto' }]}
      />
    </View>
  );
}
