import { adminDb } from './firebaseAdmin';
import { log } from './log';

const dayKey = (now: Date) => now.toISOString().slice(0, 10).replace(/-/g, '');

/**
 * Per-user daily cap for paid AI calls. Server-only document
 * (users/{uid}/usage/ai-YYYYMMDD is denied to clients by rules).
 * Returns false when the user is over the limit.
 */
export async function consumeAiQuota(uid: string, limit = 30, now = new Date()): Promise<boolean> {
  const ref = adminDb().collection('users').doc(uid).collection('usage').doc(`ai-${dayKey(now)}`);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = (snap.get('count') as number | undefined) ?? 0;
    if (count >= limit) return false;
    tx.set(ref, { count: count + 1, updatedAt: now.toISOString() }, { merge: true });
    return true;
  });
}

/** Project-wide daily AI budget guard (a cost kill-switch). Default 300 calls/day, env-tunable. */
export function globalAiLimit(): number {
  const n = Number(process.env.AI_DAILY_GLOBAL_LIMIT);
  return Number.isFinite(n) && n > 0 ? n : 300;
}

export async function consumeGlobalAiBudget(
  now = new Date(),
  limit = globalAiLimit(),
): Promise<{ allowed: boolean; count: number; limit: number }> {
  const ref = adminDb().collection('system').doc(`ai-${dayKey(now)}`);
  const result = await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = (snap.get('count') as number | undefined) ?? 0;
    if (count >= limit) return { allowed: false, count, limit };
    tx.set(ref, { count: count + 1, updatedAt: now.toISOString() }, { merge: true });
    return { allowed: true, count: count + 1, limit };
  });
  if (result.allowed && result.count === Math.ceil(limit * 0.8)) {
    log('warn', 'ai_budget_80_percent', { count: result.count, limit });
  }
  if (!result.allowed) log('warn', 'ai_budget_exhausted', { limit });
  return result;
}

export type AiGate = 'ok' | 'user_quota' | 'global_budget';

/** Both guards in one call, cheapest first. */
export async function consumeAi(uid: string, now = new Date()): Promise<AiGate> {
  if (!(await consumeAiQuota(uid, 30, now))) return 'user_quota';
  const g = await consumeGlobalAiBudget(now);
  return g.allowed ? 'ok' : 'global_budget';
}
