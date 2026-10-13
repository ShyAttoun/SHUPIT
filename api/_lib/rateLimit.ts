import { adminDb } from './firebaseAdmin';

export interface RateRule {
  /** Logical bucket, e.g. "api" or "ai". */
  bucket: string;
  limit: number;
  windowSec: number;
}

export interface RateStore {
  /** Atomically increments and returns the count for this key within the window. */
  hit(uid: string, bucket: string, windowStartMs: number, windowSec: number): Promise<number>;
}

export const DEFAULT_RULE: RateRule = { bucket: 'api', limit: 120, windowSec: 60 };
export const AI_RULE: RateRule = { bucket: 'ai', limit: 20, windowSec: 60 };
export const SENSITIVE_RULE: RateRule = { bucket: 'sensitive', limit: 5, windowSec: 3600 };

export function windowStartMs(nowMs: number, windowSec: number): number {
  const w = windowSec * 1000;
  return Math.floor(nowMs / w) * w;
}

export interface RateResult {
  allowed: boolean;
  count: number;
  retryAfterSec: number;
}

/** Fixed-window limiter. Pure apart from the injected store. */
export async function checkRate(
  store: RateStore,
  uid: string,
  rule: RateRule,
  nowMs = Date.now(),
): Promise<RateResult> {
  const start = windowStartMs(nowMs, rule.windowSec);
  const count = await store.hit(uid, rule.bucket, start, rule.windowSec);
  const retryAfterSec = Math.max(1, Math.ceil((start + rule.windowSec * 1000 - nowMs) / 1000));
  return { allowed: count <= rule.limit, count, retryAfterSec };
}

/** Firestore-backed store (server-only collection `rateLimits`; cleaned up by the cleanup cron). */
export const firestoreRateStore: RateStore = {
  async hit(uid, bucket, startMs, windowSec) {
    const db = adminDb();
    const ref = db.collection('rateLimits').doc(`${uid}__${bucket}__${startMs}`);
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const count = ((snap.get('count') as number | undefined) ?? 0) + 1;
      tx.set(ref, {
        uid,
        bucket,
        count,
        // Kept past the window so late requests are still counted; removed by cleanup.
        expireAt: new Date(startMs + windowSec * 1000 * 2).toISOString(),
      });
      return count;
    });
  },
};

/** In-memory store for tests. */
export function memoryRateStore(): RateStore & { size: () => number } {
  const m = new Map<string, number>();
  return {
    async hit(uid, bucket, startMs) {
      const k = `${uid}|${bucket}|${startMs}`;
      const n = (m.get(k) ?? 0) + 1;
      m.set(k, n);
      return n;
    },
    size: () => m.size,
  };
}
