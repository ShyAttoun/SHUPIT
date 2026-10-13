import { Tabs, useRouter } from 'expo-router';
import { Bell, Heart, Home, Package, Store, UserRound } from 'lucide-react-native';
import { useUnreadCount } from '@/features/notifications/hooks';
import { Text } from '@/design';
import { Pressable, View } from 'react-native';
import { LogoMark, useTheme } from '@/design';
import { ThemeToggle } from '@/design/ThemeToggle';
import { useTranslation } from '@/i18n';

export default function TabsLayout() {
  const { colors, spacing, hitTarget, textStyle } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const unread = useUnreadCount();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleStyle: { ...textStyle('headline'), color: colors.text },
        headerLeft: () => (
          <View role="banner" style={{ paddingHorizontal: spacing.md }}>
            <LogoMark size={28} />
          </View>
        ),
        headerRight: () => (
          <View
            role="navigation"
            aria-label={t('header.settings')}
            style={{ flexDirection: 'row', alignItems: 'center' }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                unread > 0 ? `${t('notifications.bell')} (${unread})` : t('notifications.bell')
              }
              onPress={() => router.push('/notifications')}
              style={{ width: hitTarget, height: hitTarget, alignItems: 'center', justifyContent: 'center' }}
            >
              <Bell size={24} color={colors.text} />
              {unread > 0 ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 6,
                    end: 4,
                    minWidth: 18,
                    height: 18,
                    paddingHorizontal: 4,
                    borderRadius: 9,
                    backgroundColor: colors.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text variant="caption" color="onAccent" style={{ fontSize: 11, lineHeight: 14 }}>
                    {unread > 9 ? '9+' : String(unread)}
                  </Text>
                </View>
              ) : null}
            </Pressable>
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
            <ThemeToggle />
          </View>
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
