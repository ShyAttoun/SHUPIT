import { Store } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Screen, Text, useTheme } from '@/design';
import { useTranslation } from '@/i18n';
import { toggleFavoriteList, useStoresMutations } from './hooks';
import { StorePicker } from './StorePicker';

export function StoresOnboarding({ initial = [] }: { initial?: string[] }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { saveFavorites, skipOnboarding } = useStoresMutations();
  const [selected, setSelected] = useState<string[]>(initial);

  return (
    <Screen scroll>
      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.xs, paddingTop: spacing.md }}>
          <Store size={32} color={colors.accentText} />
          <Text variant="display" accessibilityRole="header">
            {t('stores.onboarding.title')}
          </Text>
          <Text color="textSecondary">{t('stores.onboarding.body')}</Text>
        </View>

        <StorePicker selected={selected} onToggle={(id) => setSelected((s) => toggleFavoriteList(s, id))} />

        {saveFavorites.isError || skipOnboarding.isError ? (
          <Text color="danger" accessibilityLiveRegion="polite">
            {t('common.saveFailed')}
          </Text>
        ) : null}

        <View style={{ gap: spacing.sm }}>
          <Text color="textSecondary" variant="small">
            {t('stores.onboarding.selected', { count: selected.length })}
          </Text>
          <Button
            label={t('stores.onboarding.continue')}
            disabled={selected.length === 0}
            loading={saveFavorites.isPending}
            onPress={() => saveFavorites.mutate({ ids: selected, markDone: true })}
          />
          <Button
            variant="ghost"
            label={t('stores.onboarding.skip')}
            loading={skipOnboarding.isPending}
            onPress={() => skipOnboarding.mutate()}
          />
        </View>
      </View>
    </Screen>
  );
}
