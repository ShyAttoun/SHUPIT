import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Heart,
  MapPin,
  Package,
  Puzzle,
  ShieldCheck,
  ShoppingBag,
  Store,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { Button, LogoMark, Text, useTheme } from '@/design';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTranslation } from '@/i18n';
import { connectExtension, extensionSupported } from '@/lib/extension';
import { shouldShowWalkthrough, useWalkthroughStore } from './store';

interface Step {
  key: string;
  Icon: LucideIcon;
  bullets: number;
}

const STEPS: Step[] = [
  { key: 'welcome', Icon: ShoppingBag, bullets: 0 },
  { key: 'stores', Icon: Store, bullets: 3 },
  { key: 'wishlist', Icon: Heart, bullets: 4 },
  { key: 'orders', Icon: Package, bullets: 4 },
  { key: 'pickup', Icon: MapPin, bullets: 3 },
  { key: 'extension', Icon: Puzzle, bullets: 4 },
  { key: 'alerts', Icon: Bell, bullets: 3 },
  { key: 'privacy', Icon: ShieldCheck, bullets: 3 },
];

/**
 * First-run guided tour: what SHUPIT does, how to use each tab, and how to use the Chrome extension.
 * Reopenable from Settings. Works with keyboard (←/→/Esc), RTL and screen readers.
 */
export function Walkthrough() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { colors, spacing, radius, isRTL, isWide, elevation } = useTheme();
  const { seenFor, replaying, markSeen, closeReplay } = useWalkthroughStore();
  const [i, setI] = useState(0);
  const [extState, setExtState] = useState<string | null>(null);

  const visible = shouldShowWalkthrough({ uid: user?.uid, seenFor, replaying });
  const last = i === STEPS.length - 1;
  const step = STEPS[i]!;

  const finish = useCallback(() => {
    if (user) markSeen(user.uid);
    closeReplay();
    setI(0);
  }, [user, markSeen, closeReplay]);

  const next = useCallback(() => (last ? finish() : setI((v) => v + 1)), [last, finish]);
  const back = useCallback(() => setI((v) => Math.max(0, v - 1)), []);

  // Keyboard: arrows follow reading direction; Escape skips.
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight') (isRTL ? back : next)();
      if (e.key === 'ArrowLeft') (isRTL ? next : back)();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, isRTL, next, back, finish]);

  if (!visible) return null;
  const Icon = step.Icon;
  const Forward = isRTL ? ChevronLeft : ChevronRight;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={finish}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.md }}>
        <View
          role="dialog"
          aria-modal
          aria-label={t('walkthrough.title')}
          style={{
            width: '100%',
            maxWidth: isWide ? 560 : 480,
            maxHeight: '94%',
            borderRadius: radius.xl,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
            ...elevation(3),
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: spacing.md,
              paddingTop: spacing.sm,
            }}
          >
            <LogoMark size={28} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('walkthrough.skip')}
              onPress={finish}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: spacing.xs }}
            >
              <Text variant="label" color="textSecondary">
                {t('walkthrough.skip')}
              </Text>
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
            <View
              style={{
                alignSelf: 'center',
                width: 96,
                height: 96,
                borderRadius: 32,
                backgroundColor: colors.accentSoft,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={44} color={colors.accentText} />
            </View>

            <Text variant="caption" color="accentText" style={{ textAlign: 'center' }}>
              {t('walkthrough.progress', { current: i + 1, total: STEPS.length })}
            </Text>
            <Text variant="title" accessibilityRole="header" style={{ textAlign: 'center' }}>
              {t(`walkthrough.${step.key}.title`)}
            </Text>
            <Text color="textSecondary" style={{ textAlign: 'center' }}>
              {t(`walkthrough.${step.key}.body`)}
            </Text>

            {step.bullets > 0 ? (
              <View style={{ gap: spacing.xs }}>
                {Array.from({ length: step.bullets }, (_, n) => (
                  <View
                    key={n}
                    style={{
                      flexDirection: 'row',
                      gap: spacing.sm,
                      alignItems: 'flex-start',
                      padding: spacing.sm,
                      borderRadius: radius.lg,
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: colors.accent,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text variant="caption" color="onAccent">
                        {n + 1}
                      </Text>
                    </View>
                    <Text style={{ flex: 1 }}>{t(`walkthrough.${step.key}.b${n + 1}`)}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {step.key === 'extension' && Platform.OS === 'web' && extensionSupported() ? (
              <View style={{ gap: spacing.xs }}>
                <Button
                  variant="secondary"
                  label={t('settings.extension.connect')}
                  onPress={() => void connectExtension().then((r) => setExtState(String(r)))}
                />
                {extState ? (
                  <Text variant="small" color={extState === 'connected' ? 'success' : 'textSecondary'} accessibilityLiveRegion="polite">
                    {extState === 'connected'
                      ? t('settings.extension.connected')
                      : extState === 'not_installed'
                        ? t('settings.extension.notInstalled')
                        : t('settings.extension.failed')}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </ScrollView>

          <View style={{ gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }} accessibilityElementsHidden>
              {STEPS.map((s, n) => (
                <View
                  key={s.key}
                  style={{
                    width: n === i ? 22 : 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: n === i ? colors.accent : colors.border,
                  }}
                />
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {i > 0 ? <Button variant="secondary" label={t('common.back')} onPress={back} /> : null}
              <Button
                style={{ flex: 1 }}
                label={last ? t('walkthrough.done') : t('walkthrough.next')}
                icon={last ? undefined : <Forward size={18} color={colors.onAccent} />}
                onPress={next}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
