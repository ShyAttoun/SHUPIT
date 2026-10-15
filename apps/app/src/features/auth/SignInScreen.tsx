import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Heart, Package, ShoppingBag } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { z } from 'zod';
import { LogoMark, Screen, Text, Toggle, useTheme } from '@/design';
import { Floating } from '@/features/walkthrough/Mockups';
import { LegalLinks } from '@/legal/LegalLinks';
import { setConsents } from '@/lib/account';
import { useTranslation } from '@/i18n';
import { AppleButton } from './AppleButton';
import { AppleWebButton } from './AppleWebButton';
import { AuthInput } from './AuthInput';
import { useAuth } from './AuthProvider';
import { authErrorKey } from './errors';
import { GoogleButton } from './GoogleButton';

type FormValues = { email: string; password: string };

const glow =
  Platform.OS === 'web'
    ? ({
        backgroundImage:
          'radial-gradient(ellipse 70% 40% at 15% 0%, rgba(0,184,176,0.18), transparent 70%), radial-gradient(ellipse 60% 35% at 100% 8%, rgba(0,184,176,0.14), transparent 70%), radial-gradient(ellipse 80% 30% at 50% 100%, rgba(0,184,176,0.12), transparent 70%)',
      } as object)
    : {};

export function SignInScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { colors, spacing, radius, isRTL, elevation } = theme;
  const { height } = useWindowDimensions();
  const {
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    googleSupported,
    signInWithApple,
    appleSupported,
    resetPassword,
  } = useAuth();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [appleBusy, setAppleBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const schema = z.object({
    email: z.string().trim().email(t('auth.errors.invalidEmail')),
    password: z.string().min(8, t('auth.errors.passwordShort')),
  });

  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    setNotice(null);
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

  const social = async (run: () => Promise<void>, busy: (v: boolean) => void) => {
    setFormError(null);
    setNotice(null);
    busy(true);
    try {
      await run();
      void setConsents({ terms: true }).catch(() => undefined);
    } catch (e) {
      const code = (e as { code?: string }).code;
      // Closing the sheet/popup is a choice, not an error.
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setFormError(t(`auth.errors.${authErrorKey(e)}`));
      }
    } finally {
      busy(false);
    }
  };

  const onForgot = async () => {
    setFormError(null);
    const email = getValues('email').trim();
    if (!z.string().email().safeParse(email).success) {
      setNotice(null);
      setFormError(t('auth.forgotNeedEmail'));
      return;
    }
    try {
      await resetPassword(email);
      setNotice(t('auth.forgotSent'));
    } catch (e) {
      setFormError(t(`auth.errors.${authErrorKey(e)}`));
    }
  };

  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const compact = height < 700;
  const providers = (appleSupported ? 1 : 0) + (googleSupported ? 1 : 0);

  return (
    <Screen scroll topInset style={glow}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          gap: spacing.lg,
          maxWidth: 440,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        {/* Brand */}
        <View style={{ alignItems: 'center', gap: spacing.xxs }}>
          {/* Soft decorative elements sit beside the logo (never on it); hidden on very short screens */}
          {!compact ? (
            <View
              pointerEvents="none"
              style={{ position: 'absolute', top: 0, width: 280, height: 110, alignSelf: 'center' }}
            >
              <Floating style={{ top: 6, start: 8 }} phase={0}>
                <View style={{ transform: [{ rotate: '-10deg' }], opacity: 0.95 }}>
                  <Deco Icon={ShoppingBag} size={46} />
                </View>
              </Floating>
              <Floating style={{ top: 62, start: 52 }} phase={600}>
                <Deco Icon={Heart} color="#E5446D" size={32} />
              </Floating>
              <Floating style={{ top: 10, end: 8 }} phase={300}>
                <View style={{ transform: [{ rotate: '8deg' }], opacity: 0.95 }}>
                  <Deco Icon={Package} color="#C99A66" size={46} />
                </View>
              </Floating>
            </View>
          ) : null}
          <LogoMark size={compact ? 56 : 72} />
          <Text variant="display" accessibilityRole="header" style={{ textAlign: 'center' }}>
            {t('common.appName')}
          </Text>
          <Text color="textSecondary" style={{ textAlign: 'center' }}>
            {t('auth.tagline')}
          </Text>
        </View>

        {/* Login / register switcher */}
        <View
          accessibilityRole="tablist"
          style={{
            flexDirection: 'row',
            padding: 4,
            gap: 4,
            borderRadius: radius.full,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
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
                  setNotice(null);
                  setMode(m);
                }}
                style={{
                  flex: 1,
                  minHeight: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: radius.full,
                  backgroundColor: active ? colors.accent : 'transparent',
                }}
              >
                <Text variant="bodyStrong" color={active ? 'onAccent' : 'text'}>
                  {m === 'signIn' ? t('auth.signIn') : t('auth.signUp')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Form card */}
        <View
          style={{
            gap: spacing.md,
            padding: spacing.lg,
            borderRadius: radius.xl,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            ...elevation(2),
          }}
        >
          <View style={{ gap: 2 }}>
            <Text variant="title" accessibilityRole="header">
              {mode === 'signIn' ? t('auth.signInTitle') : t('auth.signUpTitle')}
            </Text>
            <Text color="textSecondary">
              {mode === 'signIn' ? t('auth.loginSubtitle') : t('auth.signUpSubtitle')}
            </Text>
          </View>

          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <AuthInput
                kind="email"
                label={t('auth.email')}
                showLabel={t('auth.showPassword')}
                hideLabel={t('auth.hidePassword')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.email?.message}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                inputMode="email"
                textContentType="emailAddress"
                returnKeyType="next"
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <AuthInput
                kind="password"
                label={t('auth.password')}
                showLabel={t('auth.showPassword')}
                hideLabel={t('auth.hidePassword')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.password?.message}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
                returnKeyType="go"
                onSubmitEditing={onSubmit}
              />
            )}
          />

          {mode === 'signIn' ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => void onForgot()}
              style={{ alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center' }}
            >
              <Text variant="small" color="accentText" style={{ fontWeight: '600' }}>
                {t('auth.forgot')}
              </Text>
            </Pressable>
          ) : (
            <View style={{ gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Toggle accessibilityLabel={t('legal.agreePrefix')} value={agreed} onValueChange={setAgreed} />
                <Text variant="small" style={{ flex: 1 }}>
                  {t('legal.agreePrefix')} {t('legal.terms')} {t('legal.and')}
                  {t('legal.privacy')}
                </Text>
              </View>
              <LegalLinks />
            </View>
          )}

          {notice ? (
            <Text color="success" variant="small" accessibilityLiveRegion="polite">
              {notice}
            </Text>
          ) : null}
          {formError ? (
            <Text color="danger" variant="small" accessibilityLiveRegion="polite">
              {formError}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: isSubmitting, disabled: isSubmitting }}
            disabled={isSubmitting}
            onPress={onSubmit}
            style={({ pressed }) => ({
              minHeight: 52,
              borderRadius: radius.lg,
              backgroundColor: colors.accent,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs,
              opacity: isSubmitting ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
              ...elevation(1),
            })}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <>
                <Text variant="bodyStrong" color="onAccent">
                  {mode === 'signIn' ? t('auth.signInSubmit') : t('auth.signUpSubmit')}
                </Text>
                <Arrow size={18} color={colors.onAccent} />
              </>
            )}
          </Pressable>

          {providers > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                <Text variant="caption" color="textSecondary">
                  {t('auth.orContinue')}
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              </View>
              <View style={{ gap: spacing.xs }}>
                {appleSupported ? (
                  Platform.OS === 'web' ? (
                    <AppleWebButton
                      label={t('auth.continueWithApple')}
                      loading={appleBusy}
                      onPress={() => void social(signInWithApple, setAppleBusy)}
                    />
                  ) : (
                    <AppleButton onPress={() => void social(signInWithApple, setAppleBusy)} light={theme.mode === 'light'} />
                  )
                ) : null}
                {googleSupported ? (
                  <GoogleButton
                    label={t('auth.continueWithGoogle')}
                    onPress={() => void social(signInWithGoogle, setGoogleBusy)}
                    loading={googleBusy}
                  />
                ) : null}
              </View>
              <Text variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>
                {t('auth.googleAgree')}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Switch prompt */}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setFormError(null);
            setNotice(null);
            setMode(mode === 'signIn' ? 'signUp' : 'signIn');
          }}
          style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text variant="small" color="textSecondary" style={{ textAlign: 'center' }}>
            {mode === 'signIn' ? t('auth.newHere') : t('auth.haveAccountPrefix')}{' '}
            <Text variant="bodyStrong" color="accentText">
              {mode === 'signIn' ? t('auth.createFreeLink') : t('auth.signInLink')}
            </Text>
          </Text>
        </Pressable>

        {mode === 'signIn' ? <LegalLinks center /> : null}
      </View>
    </Screen>
  );
}

function Deco({ Icon, color = '#00B8B0', size = 52 }: { Icon: typeof Heart; color?: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(0,184,176,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: color,
        shadowOpacity: 0.25,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      }}
    >
      <Icon size={size * 0.5} color={color} />
    </View>
  );
}
