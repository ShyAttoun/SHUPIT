import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ensureHomeBeneath } from '@/lib/backGuard';
import { HeaderBack } from '@/design/HeaderBack';
import { useTheme } from '@/design';
import { useTranslation } from '@/i18n';
import { Walkthrough } from '@/features/walkthrough/Walkthrough';

export default function AppLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  // Android draws edge-to-edge: keep stack screens above the system navigation bar / gesture area.
  const insets = useSafeAreaInsets();
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
        contentStyle: { backgroundColor: colors.background, paddingBottom: insets.bottom },
        headerBackTitle: t('common.back'),
        headerLeft: () => <HeaderBack />,
      }}
    >
      {/* The tab bar already accounts for the bottom inset. */}
      <Stack.Screen
        name="(tabs)"
        options={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      />
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
