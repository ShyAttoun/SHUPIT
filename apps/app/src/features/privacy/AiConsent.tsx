import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState, type ReactElement } from 'react';
import { Modal, View } from 'react-native';
import { Button, Text, useTheme } from '@/design';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTranslation } from '@/i18n';
import { getConsents, setConsents } from '@/lib/account';

export function useConsents() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['consents', user?.uid],
    enabled: !!user,
    queryFn: getConsents,
  });
}

/**
 * Gate for AI features. `ensure()` resolves true when the user has (or just gave) consent and
 * false when they decline. Render `modal` somewhere in the screen. The server enforces consent too.
 */
export function useAiConsent(): { ensure: () => Promise<boolean>; modal: ReactElement } {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const ensure = useCallback(async () => {
    try {
      const c = await qc.fetchQuery({ queryKey: ['consents', user?.uid], queryFn: getConsents, staleTime: 0 });
      if (c.aiProcessing) return true;
    } catch {
      // If we can't read it, ask: the server is the source of truth anyway.
    }
    setFailed(false);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, [qc, user?.uid]);

  const finish = (v: boolean) => {
    setOpen(false);
    resolver.current?.(v);
    resolver.current = null;
  };

  const accept = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const c = await setConsents({ aiProcessing: true });
      qc.setQueryData(['consents', user?.uid], c);
      finish(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const modal = (
    <Modal visible={open} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => finish(false)}>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.md,
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: 440,
            gap: spacing.md,
            padding: spacing.lg,
            borderRadius: radius.xl,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text variant="title" accessibilityRole="header">
            {t('privacy.aiConsent.title')}
          </Text>
          <Text>{t('privacy.aiConsent.body')}</Text>
          <Text color="textSecondary" variant="small">
            {t('privacy.aiConsent.points')}
          </Text>
          <Text
            variant="small"
            color="accentText"
            accessibilityRole="link"
            onPress={() => {
              finish(false);
              router.push('/legal/privacy');
            }}
          >
            {t('legal.privacy')}
          </Text>
          {failed ? (
            <Text color="danger" accessibilityLiveRegion="polite">
              {t('common.saveFailed')}
            </Text>
          ) : null}
          <Button label={t('privacy.aiConsent.accept')} loading={busy} onPress={() => void accept()} />
          <Button variant="ghost" label={t('common.cancel')} onPress={() => finish(false)} />
        </View>
      </View>
    </Modal>
  );

  return { ensure, modal };
}
