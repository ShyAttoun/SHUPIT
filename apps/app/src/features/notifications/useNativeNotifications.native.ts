import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

// Show notifications while the app is open too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Tapping a push opens the screen named in its `url` data (same paths as web push). */
export function useNativeNotifications(): void {
  const router = useRouter();
  useEffect(() => {
    const open = (data: unknown) => {
      const url = (data as { url?: unknown } | null)?.url;
      if (typeof url === 'string' && url.startsWith('/')) router.push(url as never);
    };
    // App opened by tapping a push while closed.
    void Notifications.getLastNotificationResponseAsync().then((r) => r && open(r.notification.request.content.data));
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data));
    return () => sub.remove();
  }, [router]);
}
