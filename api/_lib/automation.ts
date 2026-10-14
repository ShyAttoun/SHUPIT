import { createHash, randomBytes } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';

const COLLECTION = 'automationKeys';
const PREFIX = 'shp_';

export const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');

/** A personal key for phone automations (iOS Shortcuts, Tasker). Only its hash is stored. */
export function generateKey(): string {
  return PREFIX + randomBytes(32).toString('base64url');
}

export function looksLikeKey(value: string | null | undefined): value is string {
  return !!value && value.startsWith(PREFIX) && value.length >= 40 && value.length <= 80;
}

/** Replaces any existing key of the user with a new one and returns the plaintext (shown once). */
export async function createKey(db: Firestore, uid: string, now = new Date()): Promise<string> {
  await revokeKeys(db, uid);
  const key = generateKey();
  await db.collection(COLLECTION).doc(hashKey(key)).set({ uid, createdAt: now.toISOString(), lastUsedAt: null });
  return key;
}

export async function revokeKeys(db: Firestore, uid: string): Promise<number> {
  const q = await db.collection(COLLECTION).where('uid', '==', uid).get();
  await Promise.all(q.docs.map((d) => d.ref.delete()));
  return q.size;
}

export async function keyStatus(db: Firestore, uid: string): Promise<{ exists: boolean; createdAt: string | null; lastUsedAt: string | null }> {
  const q = await db.collection(COLLECTION).where('uid', '==', uid).limit(1).get();
  const d = q.docs[0];
  return {
    exists: !!d,
    createdAt: (d?.get('createdAt') as string | undefined) ?? null,
    lastUsedAt: (d?.get('lastUsedAt') as string | null | undefined) ?? null,
  };
}

/** Resolves the owner of a key, or null. Touches lastUsedAt. */
export async function uidForKey(db: Firestore, key: string, now = new Date()): Promise<string | null> {
  if (!looksLikeKey(key)) return null;
  const ref = db.collection(COLLECTION).doc(hashKey(key));
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.update({ lastUsedAt: now.toISOString() });
  return snap.get('uid') as string;
}
