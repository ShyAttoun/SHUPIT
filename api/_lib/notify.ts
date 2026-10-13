import {
  DEFAULT_NOTIFICATION_PREFS,
  prefKeyFor,
  type NotificationPrefs,
  type NotificationType,
} from '@shupit/contracts';
import type { Firestore } from 'firebase-admin/firestore';

export interface NotificationDraft {
  type: NotificationType;
  /** Stable key: the same event can never notify twice. */
  dedupeKey: string;
  status?: string;
  /** Free-form, display-only payload (ids, titles, prices). No secrets. */
  data: Record<string, unknown>;
}

export async function loadPrefs(db: Firestore, uid: string): Promise<NotificationPrefs> {
  const snap = await db.collection('users').doc(uid).collection('preferences').doc('notifications').get();
  return { ...DEFAULT_NOTIFICATION_PREFS, ...((snap.data() as Partial<NotificationPrefs> | undefined) ?? {}) };
}

export type NotifyResult = 'created' | 'duplicate' | 'disabled';

/**
 * The single place notifications are created (tracking engine, manual updates, price checks).
 * - respects the user's preferences (disabled types are not stored),
 * - is idempotent: the document id is derived from the dedupe key and created with `create()`.
 */
export async function createNotification(
  db: Firestore,
  uid: string,
  draft: NotificationDraft,
  opts: { prefs?: NotificationPrefs; now?: Date } = {},
): Promise<NotifyResult> {
  const prefs = opts.prefs ?? (await loadPrefs(db, uid));
  if (!prefs[prefKeyFor(draft.type, draft.status)]) return 'disabled';

  const id = Buffer.from(draft.dedupeKey).toString('base64url').slice(0, 200);
  const ref = db.collection('users').doc(uid).collection('notifications').doc(id);
  try {
    await ref.create({
      type: draft.type,
      status: draft.status ?? null,
      dedupeKey: draft.dedupeKey,
      ...draft.data,
      createdAt: (opts.now ?? new Date()).toISOString(),
      readAt: null,
    });
    return 'created';
  } catch (e) {
    if ((e as { code?: number }).code === 6) return 'duplicate'; // ALREADY_EXISTS
    throw e;
  }
}
