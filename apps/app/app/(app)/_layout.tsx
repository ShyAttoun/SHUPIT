import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { ensureHomeBeneath } from '@/lib/backGuard';
import { HeaderBack } from '@/design/HeaderBack';
import { useTheme } from '@/design';
import { useTranslation } from '@/i18n';
import { Walkthrough } from '@/features/walkthrough/Walkthrough';

export default function AppLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  useEffect(() => {
    ensureHomeBeneath();
  }, []);
  return (
    <>
    <Walkthrough />
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
        headerBackTitle: t('common.back'),
        headerLeft: () => <HeaderBack />,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: t('settings.title') }} />
      <Stack.Screen name="notifications" options={{ title: t('notifications.title') }} />
      <Stack.Screen name="product/add" options={{ title: t('wishlist.add.title') }} />
      <Stack.Screen name="product/[id]" options={{ title: t('wishlist.title') }} />
      <Stack.Screen name="order/add" options={{ title: t('orders.form.title') }} />
      <Stack.Screen name="order/[id]" options={{ title: t('orders.title') }} />
    </Stack>
    </>
  );
}
