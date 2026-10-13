import { Stack } from 'expo-router';
import { useTheme } from '@/design';
import { useTranslation } from '@/i18n';

export default function AppLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
        headerBackTitle: t('common.back'),
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: t('settings.title') }} />
      <Stack.Screen name="product/add" options={{ title: t('wishlist.add.title') }} />
      <Stack.Screen name="product/[id]" options={{ title: t('wishlist.title') }} />
      <Stack.Screen name="order/add" options={{ title: t('orders.form.title') }} />
      <Stack.Screen name="order/[id]" options={{ title: t('orders.title') }} />
    </Stack>
  );
}
