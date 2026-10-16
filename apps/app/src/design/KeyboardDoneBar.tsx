import { InputAccessoryView, Keyboard, Platform, View } from 'react-native';
import { Button } from './Button';
import { useTheme } from './theme';

export const KEYBOARD_DONE_ID = 'shupit-keyboard-done';

/** iOS number/decimal keyboards have no return key: this bar adds a "Done" button above them. Mount once. */
export function KeyboardDoneBar({ label }: { label: string }) {
  const { colors } = useTheme();
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={KEYBOARD_DONE_ID}>
      <View
        style={{
          alignItems: 'flex-end',
          padding: 6,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Button variant="ghost" label={label} style={{ minHeight: 40 }} onPress={() => Keyboard.dismiss()} />
      </View>
    </InputAccessoryView>
  );
}
