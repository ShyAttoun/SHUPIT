import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { apiFetch } from './api';

export type PushSupport = 'supported' | 'unsupported' | 'needs_install' | 'not_configured';

const KEY = 'shupit.expoPushToken';
const projectId = (): string | undefined =>
  (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
  (Constants.easConfig as { projectId?: string } | undefined)?.projectId;

/** Native push goes through the Expo push service; it needs the EAS project id baked into the build. */
export function pushSupport(): PushSupport {
  return projectId() ? 'supported' : 'not_configured';
}

/** Native permission state is async; the toggle reads the stored token instead. */
export const permissionState = (): NotificationPermission | 'unsupported' => 'default';

export async function hasLocalSubscription(): Promise<boolean> {
  try {
    return !!(await AsyncStorage.getItem(KEY));
  } catch {
    return false;
  }
}

export async function enablePush(lang: 'he' | 'en'): Promise<'enabled' | 'denied' | 'failed'> {
  try {
    const current = await Notifications.getPermissionsAsync();
    const status = current.granted ? 'granted' : (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return 'denied';
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: projectId() })).data;
    await apiFetch('/api/account/push', { method: 'POST', body: { expoToken: token, lang } });
    await AsyncStorage.setItem(KEY, token);
    return 'enabled';
  } catch {
    return 'failed';
  }
}

export async function disablePush(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(KEY);
    await apiFetch(
      token ? `/api/account/push?expoToken=${encodeURIComponent(token)}` : '/api/account/push',
      { method: 'DELETE' },
    );
    await AsyncStorage.removeItem(KEY);
  } catch {
    // best effort
  }
}
