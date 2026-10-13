import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Button, Screen, Text, useTheme } from '@/design';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTranslation } from '@/i18n';
import { useLanguageStore, type LanguagePreference } from '@/i18n/store';
import { useApplyLanguage } from '@/i18n/useApplyLanguage';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { user, signOut } = useAuth();
  const { preference, setPreference } = useLanguageStore();
  const { needsRestart } = useApplyLanguage();
  const router = useRouter();

  const options: { value: LanguagePreference; label: string }[] = [
    { value: 'system', label: t('settings.languageSystem') },
    { value: 'en', label: t('settings.languageEnglish') },
    { value: 'he', label: t('settings.languageHebrew') },
  ];

  return (
    <Screen scroll>
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.xxs }}>
          <Text variant="label" color="textSecondary">
            {t('settings.account')}
          </Text>
          <Text>{user?.email ?? ''}</Text>
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="label" color="textSecondary">
            {t('settings.language')}
          </Text>
          <View
            style={{
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
              overflow: 'hidden',
            }}
          >
            {options.map((o, i) => {
              const selected = preference === o.value;
              return (
                <Pressable
                  key={o.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setPreference(o.value)}
                  style={{
                    minHeight: theme.hitTarget + 4,
                    paddingHorizontal: theme.spacing.md,
                    justifyContent: 'center',
                    backgroundColor: selected ? theme.colors.accentSoft : theme.colors.background,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: theme.colors.border,
                  }}
                >
                  <Text variant={selected ? 'bodyStrong' : 'body'} color={selected ? 'accentText' : 'text'}>
                    {o.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {needsRestart ? (
            <Text variant="small" color="warning">
              {t('settings.restartForRtl')}
            </Text>
          ) : null}
        </View>

        <Button
          variant="secondary"
          label={t('settings.reopenStoresOnboarding')}
          onPress={() => router.push('/stores?pick=1')}
        />

        <Button variant="secondary" label={t('settings.signOut')} onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}
