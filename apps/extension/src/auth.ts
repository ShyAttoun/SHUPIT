import { API_BASE, FIREBASE_API_KEY } from './config';

export interface Session {
  uid: string;
  email: string | null;
  idToken: string;
  refreshToken: string;
  /** epoch ms */
  expiresAt: number;
}

const KEY = 'shupit.session';

export async function getSession(): Promise<Session | null> {
  const res = await chrome.storage.local.get(KEY);
  return (res[KEY] as Session | undefined) ?? null;
}

export async function setSession(s: Session): Promise<void> {
  await chrome.storage.local.set({ [KEY]: s });
}

export async function clearSession(): Promise<void> {
  await chrome.storage.local.remove(KEY);
}

/** Expiry (epoch ms) from the token's own `exp` claim; null if it can't be read. */
export function jwtExpiryMs(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Returns a valid ID token, refreshing it when it is about to expire (or when `force` is set).
 * Null = disconnected.
 */
export async function getIdToken(force = false): Promise<string | null> {
  const s = await getSession();
  if (!s) return null;
  const expiresAt = jwtExpiryMs(s.idToken) ?? s.expiresAt;
  if (!force && expiresAt - 60_000 > Date.now()) return s.idToken;

  try {
    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: s.refreshToken }),
    });
    if (!res.ok) {
      // Revoked or expired refresh token: require reconnecting from the app.
      if (res.status === 400 || res.status === 401) await clearSession();
      return null;
    }
    const j = (await res.json()) as { id_token: string; refresh_token: string; expires_in: string };
    await setSession({
      ...s,
      idToken: j.id_token,
      refreshToken: j.refresh_token,
      expiresAt: jwtExpiryMs(j.id_token) ?? Date.now() + Number(j.expires_in) * 1000,
    });
    return j.id_token;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public body: unknown,
  ) {
    super(code);
  }
}

export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
  retried = false,
): Promise<T> {
  const token = await getIdToken(retried);
  if (!token) throw new ApiError(401, 'disconnected', null);
  const res = await fetch(`${API_BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  // The server said the token is not valid: refresh once and retry before giving up.
  if (res.status === 401 && !retried) return api<T>(path, init, true);
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // empty
  }
  if (!res.ok) {
    throw new ApiError(res.status, (data as { error?: { code?: string } } | null)?.error?.code ?? 'request_failed', data);
  }
  return data as T;
}
