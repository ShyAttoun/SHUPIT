import { ScrollView, View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './theme';

export interface ScreenProps extends ViewProps {
  scroll?: boolean;
  /** Apply the top safe-area inset (for screens without a navigation header). */
  topInset?: boolean;
}

const MAX_WIDTH = 720;

export function Screen({ scroll = false, topInset = false, style, children, ...rest }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const content = (
    <View
      role="main"
      {...rest}
      style={[
        {
          flexGrow: 1,
          width: '100%',
          maxWidth: MAX_WIDTH,
          alignSelf: 'center',
          paddingHorizontal: theme.spacing.md,
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
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
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
    </View>
  );
}
