import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { z } from 'zod';
import { Button, LogoMark, Screen, Text, TextField, useTheme, Toggle } from '@/design';
import { LegalLinks } from '@/legal/LegalLinks';
import { setConsents } from '@/lib/account';
import { useTranslation } from '@/i18n';
import { useAuth } from './AuthProvider';
import { authErrorKey } from './errors';
import { GoogleButton } from './GoogleButton';

type FormValues = { email: string; password: string };

export function SignInScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, googleSupported } = useAuth();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [formError, setFormError] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const schema = z.object({
    email: z.string().trim().email(t('auth.errors.invalidEmail')),
    password: z.string().min(8, t('auth.errors.passwordShort')),
  });

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    if (mode === 'signUp' && !agreed) {
      setFormError(t('legal.mustAgree'));
      return;
    }
    try {
      if (mode === 'signIn') await signInWithEmail(email.trim(), password);
      else {
        await signUpWithEmail(email.trim(), password);
        // Record acceptance of the terms (best effort; the account already exists).
        void setConsents({ terms: true }).catch(() => undefined);
      }
    } catch (e) {
      setFormError(t(`auth.errors.${authErrorKey(e)}`));
    }
  });

  const onGoogle = async () => {
    setFormError(null);
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
      void setConsents({ terms: true }).catch(() => undefined);
    } catch (e) {
      const code = (e as { code?: string }).code;
      // Closing the popup is not an error worth surfacing.
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setFormError(t(`auth.errors.${authErrorKey(e)}`));
      }
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <Screen scroll topInset>
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.lg, maxWidth: 420, width: '100%', alignSelf: 'center' }}>
        <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
          <LogoMark size={72} />
          <Text variant="display" accessibilityRole="header">
            {t('common.appName')}
          </Text>
          <Text color="textSecondary" style={{ textAlign: 'center' }}>
            {t('auth.tagline')}
          </Text>
        </View>

        {/* Sign in / Create account: always visible and clearly a choice, not a small text link. */}
        <View
          accessibilityRole="tablist"
          style={{
            flexDirection: 'row',
            padding: 4,
            gap: 4,
            borderRadius: theme.radius.full,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          {(['signIn', 'signUp'] as const).map((m) => {
            const active = mode === m;
            return (
              <Pressable
                key={m}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setFormError(null);
                  setMode(m);
                }}
                style={{
                  flex: 1,
                  minHeight: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: theme.radius.full,
                  backgroundColor: active ? theme.colors.accent : 'transparent',
                }}
              >
                <Text variant="bodyStrong" color={active ? 'onAccent' : 'text'}>
                  {m === 'signIn' ? t('auth.signIn') : t('auth.signUp')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text variant="title">
          {mode === 'signIn' ? t('auth.signInTitle') : t('auth.signUpTitle')}
        </Text>

        <View style={{ gap: theme.spacing.md }}>
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <TextField
                label={t('auth.email')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.email?.message}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <TextField
                label={t('auth.password')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.password?.message}
                secureTextEntry
                autoCapitalize="none"
                autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
                onSubmitEditing={onSubmit}
              />
            )}
          />
          {mode === 'signUp' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <Toggle
                accessibilityLabel={t('legal.agreePrefix')}
                value={agreed}
                onValueChange={setAgreed}
                trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
              />
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="small">
                  {t('legal.agreePrefix')} {t('legal.terms')} {t('legal.and')}{t('legal.privacy')}
                </Text>
                <LegalLinks />
              </View>
            </View>
          ) : null}
          {formError ? (
            <Text color="danger" accessibilityLiveRegion="polite">
              {formError}
            </Text>
          ) : null}
          <Button
            label={mode === 'signIn' ? t('auth.signInSubmit') : t('auth.signUpSubmit')}
            onPress={onSubmit}
            loading={isSubmitting}
          />
        </View>

        {googleSupported ? (
          <View style={{ gap: theme.spacing.md }}>
            <Text color="textSecondary" style={{ textAlign: 'center' }}>
              {t('auth.or')}
            </Text>
            <GoogleButton label={t('auth.continueWithGoogle')} onPress={onGoogle} loading={googleBusy} />
            <Text variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>
              {t('auth.googleAgree')}
            </Text>
            <LegalLinks center />
          </View>
        ) : null}

        <View style={{ gap: theme.spacing.xs, alignItems: 'stretch' }}>
          <Text color="textSecondary" style={{ textAlign: 'center' }}>
            {mode === 'signIn' ? t('auth.noAccount') : t('auth.haveAccount')}
          </Text>
          <Button
            variant="secondary"
            label={mode === 'signIn' ? t('auth.createFree') : t('auth.backToSignIn')}
            onPress={() => {
              setFormError(null);
              setMode(mode === 'signIn' ? 'signUp' : 'signIn');
            }}
          />
        </View>
      </View>
    </Screen>
  );
}
