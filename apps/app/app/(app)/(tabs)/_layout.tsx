import { Tabs, useRouter } from 'expo-router';
import { Heart, Home, Package, Store, UserRound } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { LogoMark, useTheme } from '@/design';
import { useTranslation } from '@/i18n';

export default function TabsLayout() {
  const { colors, spacing, hitTarget, textStyle } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleStyle: { ...textStyle('headline'), color: colors.text },
        headerLeft: () => (
          <View style={{ paddingHorizontal: spacing.md }}>
            <LogoMark size={28} />
          </View>
        ),
        headerRight: () => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('header.settings')}
            onPress={() => router.push('/settings')}
            style={{
              width: hitTarget,
              height: hitTarget,
              alignItems: 'center',
              justifyContent: 'center',
              marginHorizontal: spacing.xxs,
            }}
          >
            <UserRound size={24} color={colors.text} />
          </Pressable>
        ),
        tabBarActiveTintColor: colors.accentText,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        tabBarLabelStyle: textStyle('caption'),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="stores"
        options={{
          title: t('tabs.stores'),
          tabBarIcon: ({ color, size }) => <Store color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{
          title: t('tabs.wishlist'),
          tabBarIcon: ({ color, size }) => <Heart color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t('tabs.orders'),
          tabBarIcon: ({ color, size }) => <Package color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
