import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from './firebaseAdmin';
import { bearerToken, errorResponse } from './http';

export type AuthedHandler = (request: Request, user: DecodedIdToken) => Promise<Response> | Response;

/** Verifies the Firebase ID token before running the handler. Server-side authorization boundary. */
export function withAuth(handler: AuthedHandler, verify: (t: string) => Promise<DecodedIdToken> = defaultVerify) {
  return async (request: Request): Promise<Response> => {
    const token = bearerToken(request);
    if (!token) return errorResponse(401, 'unauthenticated', 'Missing bearer token');
    let user: DecodedIdToken;
    try {
      user = await verify(token);
    } catch {
      return errorResponse(401, 'unauthenticated', 'Invalid or expired token');
    }
    try {
      return await handler(request, user);
    } catch (e) {
      // Privacy-conscious: log the error class only, never request bodies or tokens.
      console.error('handler_error', e instanceof Error ? e.name : 'unknown');
      if (e instanceof SyntaxError) return errorResponse(400, 'bad_request', 'Invalid JSON');
      return errorResponse(500, 'internal', 'Unexpected error');
    }
  };
}

function defaultVerify(token: string): Promise<DecodedIdToken> {
  return adminAuth().verifyIdToken(token, true);
}
