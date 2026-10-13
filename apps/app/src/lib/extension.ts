import { Platform } from 'react-native';
import { auth } from './auth';

const EXTENSION_ID = process.env.EXPO_PUBLIC_EXTENSION_ID;

interface ChromeRuntime {
  sendMessage: (id: string, message: unknown, cb: (response: unknown) => void) => void;
  lastError?: { message?: string };
}

function runtime(): ChromeRuntime | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const c = (window as unknown as { chrome?: { runtime?: ChromeRuntime } }).chrome;
  return c?.runtime?.sendMessage ? c.runtime : null;
}

export const extensionSupported = () => Platform.OS === 'web' && !!EXTENSION_ID && !!runtime();

export type ConnectResult = 'connected' | 'not_installed' | 'not_signed_in' | 'failed';

function send(message: unknown): Promise<{ ok?: boolean } | null> {
  const rt = runtime();
  if (!rt || !EXTENSION_ID) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      rt.sendMessage(EXTENSION_ID, message, (response) => {
        // lastError is set when the extension isn't installed / not reachable.
        resolve(rt.lastError ? null : (response as { ok?: boolean } | null));
      });
    } catch {
      resolve(null);
    }
  });
}

/** Hands the current session to the SHUPIT Chrome extension (it only accepts allow-listed origins). */
export async function connectExtension(): Promise<ConnectResult> {
  const user = auth.currentUser;
  if (!user) return 'not_signed_in';
  const idToken = await user.getIdToken(true);
  const res = await send({
    type: 'connect',
    uid: user.uid,
    email: user.email,
    idToken,
    refreshToken: user.refreshToken,
    expiresIn: 3600,
  });
  if (res === null) return 'not_installed';
  return res.ok ? 'connected' : 'failed';
}

export async function disconnectExtension(): Promise<void> {
  await send({ type: 'disconnect' });
}
