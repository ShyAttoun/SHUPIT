import { useMemo, useRef, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardHeight } from '@/lib/useKeyboardHeight';
import { ScreenScrollContext } from './ScreenScroll';
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
  const keyboard = useKeyboardHeight();
  const scrollRef = useRef<ScrollView>(null);
  // Modals sit outside Screen's scroll context: bring the focused field into view within the sheet.
  const ensureVisible = useMemo(
    () => (target: View | null) => {
      if (!target || Platform.OS === 'web') return;
      setTimeout(() => {
        const inner = (scrollRef.current as unknown as { getInnerViewRef?: () => unknown })?.getInnerViewRef?.();
        if (!inner) return;
        target.measureLayout(
          inner as never,
          (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 60), animated: true }),
          () => undefined,
        );
      }, 320);
    },
    [],
  );
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
          // The sheet rises above the keyboard while typing.
          paddingBottom: keyboard,
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
            maxHeight: keyboard > 0 ? '70%' : '90%',
            backgroundColor: colors.background,
            borderTopStartRadius: radius.xl,
            borderTopEndRadius: radius.xl,
            ...(centered ? { borderRadius: radius.xl } : {}),
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <ScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.lg + insets.bottom, gap: spacing.md }} keyboardShouldPersistTaps="handled">
            <View style={{ alignItems: 'center' }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>
            <Text variant="headline" accessibilityRole="header">
              {title}
            </Text>
            <ScreenScrollContext.Provider value={ensureVisible}>{children}</ScreenScrollContext.Provider>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
