import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  Heebo_400Regular,
  Heebo_500Medium,
  Heebo_600SemiBold,
  Heebo_700Bold,
} from '@expo-google-fonts/heebo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardDoneBar, ThemeProvider, ToastProvider, useTheme } from '@/design';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import '@/i18n';
import { useApplyLanguage } from '@/i18n/useApplyLanguage';
import { initInstallPrompt, registerServiceWorker } from '@/lib/pwa';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { installGlobalErrorReporting } from '@/lib/errorReporting';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from '@/i18n';
import { useNativeShare } from '@/features/share/useNativeShare';
import { useNativeNotifications } from '@/features/notifications/useNativeNotifications';
import { useIncomingShare } from '@/lib/incomingShare';

void SplashScreen.preventAutoHideAsync();

// Web/PWA: service worker + install prompt (no-ops on native).
registerServiceWorker();
initInstallPrompt();
installGlobalErrorReporting();

const PENDING_SHARE_KEY = 'shupit.pendingShare';

function RootNavigator() {
  const { status } = useAuth();
  const { mode } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  useApplyLanguage();
  useNativeShare();
  useNativeNotifications();
  const incoming = useIncomingShare((s) => s.incoming);

  // A share received from another app opens the share screen (after sign-in, if needed).
  useEffect(() => {
    if (incoming && status === 'signedIn') router.replace('/share?from=native' as never);
  }, [incoming, status, router]);

  // A share can arrive before the user is signed in. Remember it, then resume after sign-in.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      if (window.location.pathname === '/share' && status !== 'signedIn') {
        window.sessionStorage.setItem(PENDING_SHARE_KEY, window.location.search);
      }
      if (status === 'signedIn') {
        const pending = window.sessionStorage.getItem(PENDING_SHARE_KEY);
        if (pending !== null) {
          window.sessionStorage.removeItem(PENDING_SHARE_KEY);
          router.replace(`/share${pending}` as never);
        }
      }
    } catch {
      // sessionStorage unavailable
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);

  if (status === 'loading') return null;

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <KeyboardDoneBar label={t('common.done')} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={status === 'signedIn'}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'signedOut'}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        {/* Public: reachable signed in or out. */}
        <Stack.Screen name="legal/[doc]" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
      }),
  );
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Heebo_400Regular,
    Heebo_500Medium,
    Heebo_600SemiBold,
    Heebo_700Bold,
  });

  // Fall back to system fonts rather than blocking the app on a font error.
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <ErrorBoundary>
                <RootNavigator />
              </ErrorBoundary>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
