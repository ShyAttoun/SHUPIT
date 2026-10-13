import { Store, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text, useTheme } from '@/design';
import { useTranslation } from '@/i18n';
import { toggleFavoriteList } from './hooks';
import { StorePicker } from './StorePicker';

/**
 * Full-screen store selection with a sticky "Save my stores" bar that appears
 * after the first selection. Used for first-run, empty state and the add-more modal.
 */
export function StorePickerScreen({
  initial,
  title,
  body,
  saving,
  failed,
  onSave,
  onSkip,
  onClose,
}: {
  initial: string[];
  title: string;
  body?: string;
  saving: boolean;
  failed: boolean;
  onSave: (ids: string[]) => void;
  onSkip?: () => void;
  onClose?: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, hitTarget } = useTheme();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string[]>(initial);

  const changed =
    selected.length !== initial.length || selected.some((id) => !initial.includes(id));
  const showBar = selected.length > 0 && (changed || initial.length === 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.md,
          paddingTop: onClose ? insets.top + spacing.sm : spacing.md,
          paddingBottom: showBar ? 140 : spacing.xl,
          width: '100%',
          maxWidth: 720,
          alignSelf: 'center',
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.xs }}>
            {onClose ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                onPress={onClose}
                style={{
                  alignSelf: 'flex-end',
                  width: hitTarget,
                  height: hitTarget,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={24} color={colors.text} />
              </Pressable>
            ) : (
              <Store size={32} color={colors.accentText} />
            )}
            <Text variant="display" accessibilityRole="header">
              {title}
            </Text>
            {body ? <Text color="textSecondary">{body}</Text> : null}
          </View>

          <StorePicker
            selected={selected}
            onToggle={(id) => setSelected((s) => toggleFavoriteList(s, id))}
          />

          {onSkip ? (
            <Button variant="ghost" label={t('stores.onboarding.skip')} onPress={onSkip} />
          ) : null}
        </View>
      </ScrollView>

      {showBar ? (
        <View
          style={{
            position: 'absolute',
            start: 0,
            end: 0,
            bottom: 0,
            paddingTop: spacing.sm,
            paddingBottom: Math.max(insets.bottom, spacing.md),
            paddingHorizontal: spacing.md,
            backgroundColor: colors.background,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <View style={{ width: '100%', maxWidth: 720, alignSelf: 'center', gap: spacing.xs }}>
            {failed ? (
              <Text color="danger" variant="small" accessibilityLiveRegion="polite">
                {t('common.saveFailed')}
              </Text>
            ) : (
              <Text variant="small" color="textSecondary">
                {t('stores.onboarding.selected', { count: selected.length })}
              </Text>
            )}
            <Button label={t('stores.saveStores')} loading={saving} onPress={() => onSave(selected)} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
