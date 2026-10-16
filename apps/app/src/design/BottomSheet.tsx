import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { useTheme } from './theme';

/** Modal sheet: anchored to the bottom on phones, centered card on wider screens. Escape/backdrop closes. */
export function BottomSheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { colors, spacing, radius, isWide, breakpoint } = useTheme();
  const centered = breakpoint !== 'phone';
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType={centered ? 'fade' : 'slide'} onRequestClose={onClose}>
      <Pressable
        accessibilityLabel={title}
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: centered ? 'center' : 'flex-end',
          alignItems: 'center',
        }}
      >
        <Pressable
          role="dialog"
          aria-modal
          aria-label={title}
          onPress={() => {}}
          style={{
            width: '100%',
            maxWidth: isWide ? 520 : 560,
            maxHeight: '90%',
            backgroundColor: colors.background,
            borderTopStartRadius: radius.xl,
            borderTopEndRadius: radius.xl,
            ...(centered ? { borderRadius: radius.xl } : {}),
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.lg + insets.bottom, gap: spacing.md }} keyboardShouldPersistTaps="handled">
            <View style={{ alignItems: 'center' }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>
            <Text variant="headline" accessibilityRole="header">
              {title}
            </Text>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
