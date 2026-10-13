import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from './firebaseAdmin';
import { bearerToken, errorResponse, json } from './http';
import { DEFAULT_RULE, checkRate, firestoreRateStore, type RateRule, type RateStore } from './rateLimit';

export type AuthedHandler = (request: Request, user: DecodedIdToken) => Promise<Response> | Response;

export interface AuthOptions {
  /** Token verifier (overridable in tests). */
  verify?: (token: string) => Promise<DecodedIdToken>;
  /** Rate rule; defaults to 120 requests/min per user. Pass `false` to disable. */
  rate?: RateRule | false;
  /** Rate store (overridable in tests). */
  store?: RateStore;
}

function defaultVerify(token: string): Promise<DecodedIdToken> {
  return adminAuth().verifyIdToken(token, true);
}

/**
 * Server-side authorization boundary: verifies the Firebase ID token, enforces a per-user rate
 * limit, then runs the handler. Every user-specific endpoint must be wrapped in this.
 */
export function withAuth(handler: AuthedHandler, opts: AuthOptions = {}) {
  const verify = opts.verify ?? defaultVerify;
  const rule = opts.rate === undefined ? DEFAULT_RULE : opts.rate;
  const store = opts.store ?? firestoreRateStore;

  return async (request: Request): Promise<Response> => {
    const token = bearerToken(request);
    if (!token) return errorResponse(401, 'unauthenticated', 'Missing bearer token');
    let user: DecodedIdToken;
    try {
      user = await verify(token);
    } catch {
      return errorResponse(401, 'unauthenticated', 'Invalid or expired token');
    }

    if (rule) {
      try {
        const r = await checkRate(store, user.uid, rule);
        if (!r.allowed) {
          return json(
            { error: { code: 'rate_limited', message: 'Too many requests' } },
            429,
            { 'retry-after': String(r.retryAfterSec) },
            request,
          );
        }
      } catch {
        // Fail open: a limiter outage must not take the product down. Logged without identifiers.
        console.error('rate_limit_store_error');
      }
    }

    try {
      return await handler(request, user);
    } catch (e) {
      // Privacy-conscious: log the error class only, never request bodies, tokens or identifiers.
      console.error('handler_error', e instanceof Error ? e.name : 'unknown');
      if (e instanceof SyntaxError) return errorResponse(400, 'bad_request', 'Invalid JSON');
      return errorResponse(500, 'internal', 'Unexpected error');
    }
  };
}
