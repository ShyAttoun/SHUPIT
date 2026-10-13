import { strict as assert } from 'node:assert';
import { after, before, beforeEach, describe, it } from 'node:test';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { deleteAccountData, exportAccountData } from '../../api/_lib/account';
import { POLICY_VERSION, getConsents, hasAiConsent, setConsent } from '../../api/_lib/consent';

let app: App;
let db: Firestore;
const auth = () => getAuth(app);

before(() => {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
  app = initializeApp({ projectId: 'demo-shupit' }, `acct-${Date.now()}`);
  db = getFirestore(app);
});
after(async () => {
  await deleteApp(app);
});

async function seed(uid: string) {
  const u = db.collection('users').doc(uid);
  await u.set({ createdAt: 'x' });
  await u.collection('favoriteStores').doc('amazon').set({ merchantId: 'amazon', order: 0 });
  await u.collection('savedProducts').doc('p1').set({ title: `Lamp ${uid}` });
  await u.collection('orders').doc('o1').set({ merchantName: 'KSP', items: [{ title: 'Cable', quantity: 1 }] });
  await u.collection('shipments').doc('s1').set({ orderId: 'o1', trackingNumber: `TRK-${uid}` });
  await u.collection('shipments').doc('s1').collection('trackingEvents').doc('e1').set({ description: 'Arrived' });
  await u.collection('notifications').doc('n1').set({ type: 'shipment_status' });
  await u.collection('usage').doc('ai-20261014').set({ count: 3 });
  await db.collection('priceWatchSubscriptions').doc(`${uid}_p1`).set({ uid, enabled: true });
  await db.collection('priceAlertEvents').doc(`${uid}_a1`).set({ uid });
  await db.collection('affiliateClicks').doc(`${uid}_c1`).set({ uid, merchantId: 'amazon', kind: 'web', createdAt: '2026-10-01T00:00:00Z' });
  await db.collection('rateLimits').doc(`${uid}__api__1`).set({ uid, count: 1 });
  try {
    await auth().createUser({ uid, email: `${uid}@example.com` });
  } catch {
    // already exists from a previous run
  }
}

async function exists(path: string) {
  return (await db.doc(path).get()).exists;
}

describe('account export', () => {
  beforeEach(async () => {
    await Promise.all([seed('alice'), seed('bob')]);
  });

  it('includes nested data and only the caller’s documents', async () => {
    const data = (await exportAccountData(db, 'alice', { email: 'alice@example.com' })) as {
      formatVersion: number;
      account: { uid: string };
      userData: { collections: Record<string, { id: string; data: Record<string, unknown> | null; collections?: Record<string, { id: string }[]> }[]> };
      related: Record<string, { id: string }[]>;
    };
    assert.equal(data.formatVersion, 1);
    assert.equal(data.account.uid, 'alice');

    const cols = data.userData.collections;
    assert.deepEqual(Object.keys(cols).sort(), ['favoriteStores', 'notifications', 'orders', 'savedProducts', 'shipments', 'usage']);
    const shipment = cols.shipments![0]!;
    assert.equal(shipment.collections!.trackingEvents![0]!.id, 'e1'); // nested subcollection included

    assert.equal(data.related.priceWatchSubscriptions!.length, 1);
    assert.equal(data.related.affiliateClicks!.length, 1);
    const json = JSON.stringify(data);
    assert.ok(!json.includes('bob'), 'export must not contain another user’s data');
  });
});

describe('account deletion', () => {
  beforeEach(async () => {
    await Promise.all([seed('alice'), seed('bob')]);
  });

  it('removes all of the user’s data and the login, and leaves other users untouched', async () => {
    const summary = await deleteAccountData(db, auth(), 'alice');
    assert.equal(summary.authUserDeleted, true);

    for (const p of [
      'users/alice',
      'users/alice/orders/o1',
      'users/alice/shipments/s1',
      'users/alice/shipments/s1/trackingEvents/e1',
      'users/alice/savedProducts/p1',
      'users/alice/notifications/n1',
      'priceWatchSubscriptions/alice_p1',
      'priceAlertEvents/alice_a1',
      'rateLimits/alice__api__1',
    ]) {
      assert.equal(await exists(p), false, `${p} should be deleted`);
    }
    await assert.rejects(auth().getUser('alice'));

    // Documented exception: click record is kept but no longer linked to the person.
    const click = await db.collection('affiliateClicks').doc('alice_c1').get();
    assert.equal(click.exists, true);
    assert.equal(click.get('uid'), null);
    assert.ok(click.get('anonymizedAt'));
    assert.equal(summary.anonymizedClicks, 1);

    // Bob is untouched.
    for (const p of ['users/bob/orders/o1', 'users/bob/shipments/s1/trackingEvents/e1', 'priceWatchSubscriptions/bob_p1']) {
      assert.equal(await exists(p), true, `${p} must remain`);
    }
    assert.equal((await db.collection('affiliateClicks').doc('bob_c1').get()).get('uid'), 'bob');
    assert.ok(await auth().getUser('bob'));
  });

  it('is idempotent (safe to re-run after a partial failure)', async () => {
    await deleteAccountData(db, auth(), 'alice');
    const again = await deleteAccountData(db, auth(), 'alice');
    assert.equal(again.authUserDeleted, true);
    assert.equal(again.anonymizedClicks, 0);
  });
});

describe('consent records', () => {
  it('grant, withdraw, and invalidate on policy version change', async () => {
    const uid = 'carol';
    await db.collection('users').doc(uid).delete();
    assert.equal(await hasAiConsent(db, uid), false);

    await setConsent(db, uid, 'aiProcessing', true);
    assert.equal(await hasAiConsent(db, uid), true);
    assert.equal((await getConsents(db, uid)).policyVersion, POLICY_VERSION);

    await setConsent(db, uid, 'aiProcessing', false);
    assert.equal(await hasAiConsent(db, uid), false);

    // An acceptance recorded for an older policy version no longer counts.
    await db.collection('users').doc(uid).collection('consents').doc('current').set({
      aiProcessing: { version: '1999-01-01', acceptedAt: 'x', revokedAt: null },
    });
    assert.equal(await hasAiConsent(db, uid), false);
  });
});
