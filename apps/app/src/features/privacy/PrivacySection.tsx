import { EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup } from 'firebase/auth';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Switch, View } from 'react-native';
import { Button, Text, TextField, useTheme } from '@/design';
import { useAuth } from '@/features/auth/AuthProvider';
import { authErrorKey } from '@/features/auth/errors';
import { useTranslation } from '@/i18n';
import { deleteAccount, exportMyData, setConsents } from '@/lib/account';
import { auth } from '@/lib/auth';
import { disconnectExtension } from '@/lib/extension';
import { LegalLinks } from '@/legal/LegalLinks';
import { useConsents } from './AiConsent';

export function PrivacySection() {
  const { t } = useTranslation();
  const { spacing, colors, radius } = useTheme();
  const { signOut } = useAuth();
  const qc = useQueryClient();
  const consents = useConsents();

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [toggleBusy, setToggleBusy] = useState(false);

  const [confirming, setConfirming] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const user = auth.currentUser;
  const usesPassword = !!user?.providerData.some((p) => p.providerId === 'password');

  const doExport = async () => {
    setExporting(true);
    setExportError(false);
    try {
      await exportMyData();
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  };

  const toggleAi = async (next: boolean) => {
    setToggleBusy(true);
    try {
      const c = await setConsents({ aiProcessing: next });
      qc.setQueryData(['consents', auth.currentUser?.uid], c);
    } finally {
      setToggleBusy(false);
    }
  };

  const doDelete = async () => {
    if (!user) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      // A destructive action needs a fresh login; the server checks the token's auth time.
      if (usesPassword) {
        if (!user.email || !password) {
          setDeleteError(t('privacy.delete.needPassword'));
          setDeleting(false);
          return;
        }
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
      } else {
        await reauthenticateWithPopup(user, new GoogleAuthProvider());
      }
      await user.getIdToken(true);
      await deleteAccount();
      await disconnectExtension().catch(() => undefined);
      qc.clear();
      await signOut().catch(() => undefined);
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (code.startsWith('auth/')) setDeleteError(t(`auth.errors.${authErrorKey(e)}`));
      else setDeleteError(t('privacy.delete.failed'));
      setDeleting(false);
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Text variant="label" color="textSecondary">
        {t('privacy.title')}
      </Text>

      <View style={{ gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{t('privacy.ai.title')}</Text>
            <Text variant="small" color="textSecondary">
              {t('privacy.ai.body')}
            </Text>
          </View>
          <Switch
            accessibilityLabel={t('privacy.ai.title')}
            value={!!consents.data?.aiProcessing}
            disabled={consents.isLoading || toggleBusy}
            onValueChange={(v) => void toggleAi(v)}
            trackColor={{ true: colors.accent, false: colors.border }}
          />
        </View>
      </View>

      <LegalLinks />

      <View style={{ gap: spacing.xs }}>
        <Button
          variant="secondary"
          label={t('privacy.export.button')}
          loading={exporting}
          onPress={() => void doExport()}
        />
        <Text variant="caption" color="textSecondary">
          {t('privacy.export.hint')}
        </Text>
        {exportError ? (
          <Text color="danger" accessibilityLiveRegion="polite">
            {t('privacy.export.failed')}
          </Text>
        ) : null}
      </View>

      {!confirming ? (
        <Button variant="ghost" label={t('privacy.delete.button')} onPress={() => setConfirming(true)} />
      ) : (
        <View
          style={{
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.danger,
            backgroundColor: colors.dangerSoft,
          }}
        >
          <Text variant="headline" color="danger" accessibilityRole="header">
            {t('privacy.delete.title')}
          </Text>
          <Text color="text">{t('privacy.delete.body')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Switch
              accessibilityLabel={t('privacy.delete.understand')}
              value={understood}
              onValueChange={setUnderstood}
              trackColor={{ true: colors.danger, false: colors.border }}
            />
            <Text style={{ flex: 1 }}>{t('privacy.delete.understand')}</Text>
          </View>
          {usesPassword ? (
            <TextField
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
            />
          ) : (
            <Text variant="small" color="textSecondary">
              {t('privacy.delete.googleHint')}
            </Text>
          )}
          {deleteError ? (
            <Text color="danger" accessibilityLiveRegion="polite">
              {deleteError}
            </Text>
          ) : null}
          <Button
            label={t('privacy.delete.confirm')}
            disabled={!understood}
            loading={deleting}
            onPress={() => void doDelete()}
            style={{ backgroundColor: colors.danger }}
          />
          <Button
            variant="ghost"
            label={t('common.cancel')}
            onPress={() => {
              setConfirming(false);
              setUnderstood(false);
              setPassword('');
              setDeleteError(null);
            }}
          />
        </View>
      )}
    </View>
  );
}
