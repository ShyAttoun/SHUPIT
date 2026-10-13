import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiFetch } from './api';
import { auth } from './auth';

type Kind = 'error' | 'unhandledrejection' | 'boundary';

const MAX_PER_SESSION = 10;
const DEDUPE_MS = 60_000;
let sent = 0;
const recent = new Map<string, number>();

/** Never sends the query string or fragment: they can carry tokens. */
const safePath = () => (typeof window !== 'undefined' ? window.location.pathname : undefined);

/**
 * Reports an unexpected client error to the server (redacted there, kept 30 days).
 * Only when signed in, rate-limited per session, de-duplicated; never throws.
 */
export async function reportError(kind: Kind, error: unknown): Promise<void> {
  try {
    if (!auth.currentUser || sent >= MAX_PER_SESSION) return;
    const err = error instanceof Error ? error : new Error(String(error));
    const key = `${kind}:${err.message}`.slice(0, 200);
    const now = Date.now();
    if (now - (recent.get(key) ?? 0) < DEDUPE_MS) return;
    recent.set(key, now);
    sent++;
    await apiFetch('/api/client-errors', {
      method: 'POST',
      body: {
        kind,
        message: err.message.slice(0, 1000),
        stack: err.stack?.slice(0, 6000),
        path: safePath(),
        appVersion: Constants.expoConfig?.version,
        userAgent: Platform.OS === 'web' ? navigator.userAgent.slice(0, 300) : Platform.OS,
      },
    });
  } catch {
    // reporting must never cause another error
  }
}

let installed = false;
export function installGlobalErrorReporting() {
  if (installed || Platform.OS !== 'web' || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (e) => void reportError('error', e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => void reportError('unhandledrejection', e.reason));
}
