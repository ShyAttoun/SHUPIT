import { Platform } from 'react-native';
import { auth } from './auth';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public body?: unknown,
  ) {
    super(code);
  }
}

// Same-origin on the deployed web app; override for local dev and native.
const BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? ''
    : 'https://app.shupit.co.il');

export async function apiFetch<T>(
  path: string,
  init: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown } = {},
): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new ApiError(401, 'unauthenticated');

  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // empty body
  }
  if (!res.ok) {
    const code = (data as { error?: { code?: string } } | null)?.error?.code ?? 'request_failed';
    throw new ApiError(res.status, code, data);
  }
  return data as T;
}
