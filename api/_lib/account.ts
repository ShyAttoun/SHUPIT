import type { Auth } from 'firebase-admin/auth';
import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

export const EXPORT_FORMAT_VERSION = 1;

type Json = Record<string, unknown>;

/** Dumps a document and, recursively, all of its subcollections (future-proof: nothing is hard-coded). */
async function dumpDoc(ref: DocumentReference): Promise<Json> {
  const snap = await ref.get();
  const out: Json = { id: ref.id, data: snap.exists ? (snap.data() as Json) : null };
  const subs = await ref.listCollections();
  if (subs.length) {
    const collections: Record<string, Json[]> = {};
    for (const col of subs) {
      const docs = await col.listDocuments();
      collections[col.id] = [];
      for (const d of docs) collections[col.id]!.push(await dumpDoc(d));
    }
    out.collections = collections;
  }
  return out;
}

/** Top-level collections that hold documents about a user (by `uid` field). */
export const UID_COLLECTIONS = ['priceWatchSubscriptions', 'priceAlertEvents', 'affiliateClicks'] as const;

export async function exportAccountData(
  db: Firestore,
  uid: string,
  profile: { email: string | null; createdAt?: string | null },
  now = new Date(),
): Promise<Json> {
  const userDoc = await dumpDoc(db.collection('users').doc(uid));
  // Push subscriptions hold the device's encryption secrets: report that they exist, not the keys.
  const subs = (userDoc.collections as Record<string, { data: Record<string, unknown> | null }[]> | undefined)
    ?.pushSubscriptions;
  subs?.forEach((s) => {
    if (s.data) delete s.data.keys;
  });

  const related: Record<string, unknown[]> = {};
  for (const name of UID_COLLECTIONS) {
    const q = await db.collection(name).where('uid', '==', uid).limit(5000).get();
    related[name] = q.docs.map((d) => ({ id: d.id, ...(d.data() as Json) }));
  }

  return {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: now.toISOString(),
    account: { uid, email: profile.email, createdAt: profile.createdAt ?? null },
    // Everything stored under users/{uid}, including nested collections.
    userData: userDoc,
    // Documents kept in shared collections but owned by you.
    related,
    notes: [
      'Screenshots and page text you submit for AI reading are processed in memory and are not stored.',
      'affiliateClicks contain merchant and time only; no product URLs are stored.',
    ],
  };
}

export interface DeletionSummary {
  userDocsDeleted: boolean;
  deletedRelated: Record<string, number>;
  anonymizedClicks: number;
  authUserDeleted: boolean;
}

async function deleteByUid(db: Firestore, collection: string, uid: string): Promise<number> {
  let total = 0;
  for (;;) {
    const q = await db.collection(collection).where('uid', '==', uid).limit(400).get();
    if (q.empty) return total;
    const batch = db.batch();
    q.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += q.size;
    if (q.size < 400) return total;
  }
}

/**
 * Permanently deletes everything owned by `uid`.
 * Documented exception: affiliate click records are anonymized (uid removed) rather than deleted,
 * and are purged by the retention cron after 90 days. See docs/PRIVACY-RETENTION.md.
 * Idempotent: safe to re-run after a partial failure.
 */
export async function deleteAccountData(db: Firestore, auth: Auth, uid: string): Promise<DeletionSummary> {
  // 1. Everything under users/{uid}, all nesting levels.
  await db.recursiveDelete(db.collection('users').doc(uid));

  // 2. Owned documents in shared collections.
  const deletedRelated: Record<string, number> = {};
  for (const name of ['priceWatchSubscriptions', 'priceAlertEvents', 'rateLimits'] as const) {
    deletedRelated[name] = await deleteByUid(db, name, uid);
  }

  // 3. Affiliate clicks: remove the link to the person, keep the aggregate record.
  let anonymizedClicks = 0;
  for (;;) {
    const q = await db.collection('affiliateClicks').where('uid', '==', uid).limit(400).get();
    if (q.empty) break;
    const batch = db.batch();
    q.docs.forEach((d) => batch.update(d.ref, { uid: null, anonymizedAt: new Date().toISOString() }));
    await batch.commit();
    anonymizedClicks += q.size;
    if (q.size < 400) break;
  }

  // 4. The login itself (also invalidates all refresh tokens, including the extension's).
  let authUserDeleted = false;
  try {
    await auth.deleteUser(uid);
    authUserDeleted = true;
  } catch (e) {
    if ((e as { code?: string }).code !== 'auth/user-not-found') throw e;
    authUserDeleted = true; // already gone
  }

  return { userDocsDeleted: true, deletedRelated, anonymizedClicks, authUserDeleted };
}
