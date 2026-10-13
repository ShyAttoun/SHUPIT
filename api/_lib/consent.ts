import type { Firestore } from 'firebase-admin/firestore';

/** Bump when the privacy policy / AI disclosure changes materially; users are asked again. */
export const POLICY_VERSION = '2026-10-14';

export type ConsentKind = 'aiProcessing' | 'terms';

interface ConsentRecord {
  version: string;
  acceptedAt: string;
  revokedAt?: string | null;
}

const ref = (db: Firestore, uid: string) =>
  db.collection('users').doc(uid).collection('consents').doc('current');

export async function getConsents(
  db: Firestore,
  uid: string,
): Promise<Record<ConsentKind, boolean> & { policyVersion: string }> {
  const snap = await ref(db, uid).get();
  const active = (k: ConsentKind) => {
    const r = snap.get(k) as ConsentRecord | undefined;
    return !!r && !r.revokedAt && r.version === POLICY_VERSION;
  };
  return { aiProcessing: active('aiProcessing'), terms: active('terms'), policyVersion: POLICY_VERSION };
}

export async function setConsent(db: Firestore, uid: string, kind: ConsentKind, granted: boolean, now = new Date()) {
  const iso = now.toISOString();
  await ref(db, uid).set(
    {
      [kind]: granted
        ? ({ version: POLICY_VERSION, acceptedAt: iso, revokedAt: null } satisfies ConsentRecord)
        : { version: POLICY_VERSION, acceptedAt: iso, revokedAt: iso },
    },
    { merge: true },
  );
}

export async function hasAiConsent(db: Firestore, uid: string): Promise<boolean> {
  return (await getConsents(db, uid)).aiProcessing;
}
