import { Platform } from 'react-native';
import { apiFetch } from './api';

const VAPID = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;

export type PushSupport = 'supported' | 'unsupported' | 'needs_install' | 'not_configured';

const isWeb = () => Platform.OS === 'web' && typeof window !== 'undefined';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Whether this browser can receive push right now (iOS only inside an installed PWA). */
export function pushSupport(): PushSupport {
  if (!isWeb()) return 'unsupported';
  if (!VAPID) return 'not_configured';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    return ios ? 'needs_install' : 'unsupported';
  }
  return 'supported';
}

export const permissionState = (): NotificationPermission | 'unsupported' =>
  isWeb() && 'Notification' in window ? Notification.permission : 'unsupported';

async function registration() {
  return navigator.serviceWorker.ready;
}

export async function hasLocalSubscription(): Promise<boolean> {
  if (pushSupport() !== 'supported') return false;
  const sub = await (await registration()).pushManager.getSubscription();
  return !!sub;
}

/** Asks permission (must be called from a user gesture), subscribes and registers with the server. */
export async function enablePush(lang: 'he' | 'en'): Promise<'enabled' | 'denied' | 'failed'> {
  if (pushSupport() !== 'supported') return 'failed';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  try {
    const reg = await registration();
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID!) as unknown as BufferSource,
      }));
    await apiFetch('/api/account/push', { method: 'POST', body: { subscription: sub.toJSON(), lang } });
    return 'enabled';
  } catch {
    return 'failed';
  }
}

export async function disablePush(): Promise<void> {
  if (!isWeb()) return;
  try {
    const sub = await (await registration()).pushManager.getSubscription();
    if (sub) {
      await apiFetch(`/api/account/push?endpoint=${encodeURIComponent(sub.endpoint)}`, { method: 'DELETE' });
      await sub.unsubscribe();
    } else {
      await apiFetch('/api/account/push', { method: 'DELETE' });
    }
  } catch {
    // best effort
  }
}
