import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share2, X } from 'lucide-react-native';
import { Platform, Pressable, View } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Button, Text, useTheme } from '@/design';
import { useTranslation } from '@/i18n';
import { useInstall } from '@/lib/pwa';

const useTipStore = create<{ hidden: boolean; hide: () => void }>()(
  persist((set) => ({ hidden: false, hide: () => set({ hidden: true }) }), {
    name: 'shupit.shareTip',
    storage: createJSONStorage(() => AsyncStorage),
  }),
);

/**
 * Explains the fastest way to save a product: Share → SHUPIT from any app or browser.
 * Honest about requirements: the app must be installed, and iOS has no web share target.
 */
export function ShareTip({ dismissible = true }: { dismissible?: boolean }) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const install = useInstall();
  const { hidden, hide } = useTipStore();
  if (Platform.OS !== 'web' || (dismissible && hidden)) return null;

  return (
    <View
      accessibilityRole="summary"
      style={{
        flexDirection: 'row',
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.xl,
        backgroundColor: colors.accentSoft,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Share2 size={20} color={colors.onAccent} />
      </View>
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Text variant="bodyStrong">{t('shareTip.title')}</Text>
        <Text variant="small">{t('shareTip.body')}</Text>
        {install.ios ? (
          <Text variant="caption">
            {t('shareTip.ios')}
          </Text>
        ) : !install.standalone ? (
          <>
            <Text variant="caption">
              {t('shareTip.installFirst')}
            </Text>
            {install.canPrompt ? (
              <View style={{ alignSelf: 'flex-start' }}>
                <Button variant="secondary" label={t('install.button')} onPress={() => void install.prompt()} />
              </View>
            ) : null}
          </>
        ) : null}
      </View>
      {dismissible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={hide}
          style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={18} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}
