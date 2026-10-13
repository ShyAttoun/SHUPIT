import { adminDb } from './firebaseAdmin';

/**
 * Per-user daily cap for paid AI calls. Server-only document
 * (users/{uid}/usage/ai-YYYYMMDD is denied to clients by rules).
 * Returns false when the user is over the limit.
 */
export async function consumeAiQuota(uid: string, limit = 30, now = new Date()): Promise<boolean> {
  const day = now.toISOString().slice(0, 10).replace(/-/g, '');
  const ref = adminDb().collection('users').doc(uid).collection('usage').doc(`ai-${day}`);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = (snap.get('count') as number | undefined) ?? 0;
    if (count >= limit) return false;
    tx.set(ref, { count: count + 1, updatedAt: now.toISOString() }, { merge: true });
    return true;
  });
}
