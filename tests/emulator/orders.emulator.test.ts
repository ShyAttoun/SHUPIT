import { strict as assert } from 'node:assert';
import { after, before, beforeEach, describe, it } from 'node:test';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  DuplicateError,
  NotFoundError,
  createShipment,
  deleteShipment,
  updateOrder,
  updateShipment,
} from '../../api/_lib/ordersService';

let app: App;
let db: Firestore;

before(() => {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  app = initializeApp({ projectId: 'demo-shupit' }, `orders-${Date.now()}`);
  db = getFirestore(app);
});
after(async () => {
  await deleteApp(app);
});

const u = (uid: string) => db.collection('users').doc(uid);

async function seedOrder(uid: string, id: string, extra: Record<string, unknown> = {}) {
  await u(uid).collection('orders').doc(id).set({
    id,
    merchantId: 'ksp',
    merchantName: 'KSP',
    externalOrderId: `EXT-${id}`,
    dedupeKey: `ksp:ext${id}`,
    items: [{ title: 'Cable', quantity: 1 }],
    provenance: { items: { source: 'ai_vision', capturedAt: 'x' }, merchantName: { source: 'ai_vision', capturedAt: 'x' } },
    total: { amountMinor: 1000, currency: 'ILS' },
    ...extra,
  });
}

describe('order editing', () => {
  beforeEach(async () => {
    await db.recursiveDelete(u('ann'));
    await db.recursiveDelete(u('ben'));
    await seedOrder('ann', 'o1');
    await seedOrder('ann', 'o2');
    await seedOrder('ben', 'o1');
  });

  it('updates fields, marks edited fields as user-provided and keeps the rest', async () => {
    await updateOrder(db, 'ann', 'o1', { merchantName: 'KSP Israel', total: { amountMinor: 2500, currency: 'ILS' } });
    const d = (await u('ann').collection('orders').doc('o1').get()).data()!;
    assert.equal(d.merchantName, 'KSP Israel');
    assert.deepEqual(d.total, { amountMinor: 2500, currency: 'ILS' });
    assert.equal(d.provenance.merchantName.source, 'user');
    assert.equal(d.provenance.total.source, 'user');
    assert.equal(d.provenance.items.source, 'ai_vision', 'untouched fields keep their provenance');
    assert.deepEqual(d.items, [{ title: 'Cable', quantity: 1 }]);
  });

  it('allows clearing optional fields with null', async () => {
    await updateOrder(db, 'ann', 'o1', { total: null, purchasedAt: null });
    const d = (await u('ann').collection('orders').doc('o1').get()).data()!;
    assert.equal(d.total, null);
  });

  it('refuses an order number that already exists on another order', async () => {
    await assert.rejects(updateOrder(db, 'ann', 'o1', { externalOrderId: 'EXT-o2' }), (e) => {
      assert.ok(e instanceof DuplicateError);
      assert.equal((e as DuplicateError).existingId, 'o2');
      return true;
    });
  });

  it('cannot touch another user’s order', async () => {
    await assert.rejects(updateOrder(db, 'ann', 'does-not-exist', { merchantName: 'X' }), NotFoundError);
    // ben's o1 is separate from ann's o1
    await updateOrder(db, 'ben', 'o1', { merchantName: 'Ben only' });
    assert.equal((await u('ann').collection('orders').doc('o1').get()).get('merchantName'), 'KSP');
  });
});

describe('shipments', () => {
  beforeEach(async () => {
    await db.recursiveDelete(u('ann'));
    await db.recursiveDelete(u('ben'));
    await seedOrder('ann', 'o1');
    await seedOrder('ben', 'ob');
  });

  it('adds several shipments to one order, with pickup details', async () => {
    const a = await createShipment(db, 'ann', { orderId: 'o1', carrier: 'HFD', trackingNumber: 'T1' });
    const b = await createShipment(db, 'ann', {
      orderId: 'o1',
      carrier: 'Israel Post',
      status: 'ready_for_pickup',
      pickup: { name: 'Locker 12', address: 'Herzl 1', instructions: 'Show the code', code: '4821' },
    });
    const list = await u('ann').collection('shipments').where('orderId', '==', 'o1').get();
    assert.equal(list.size, 2);
    const doc = (await u('ann').collection('shipments').doc(b).get()).data()!;
    assert.equal(doc.status, 'ready_for_pickup');
    assert.equal(doc.statusSource, 'user'); // never presented as carrier-verified
    assert.equal(doc.pickup.code, '4821');
    assert.equal((await u('ann').collection('shipments').doc(a).get()).get('trackable'), true);
  });

  it('refuses to attach a shipment to someone else’s order', async () => {
    await assert.rejects(createShipment(db, 'ann', { orderId: 'ob' }), NotFoundError);
  });

  it('editing keeps tracking history; delivered stops tracking', async () => {
    const id = await createShipment(db, 'ann', { orderId: 'o1', trackingNumber: 'T9' });
    await u('ann').collection('shipments').doc(id).collection('trackingEvents').doc('e1').set({ description: 'Arrived' });
    await updateShipment(db, 'ann', id, { carrier: 'HFD', status: 'delivered' });
    const d = (await u('ann').collection('shipments').doc(id).get()).data()!;
    assert.equal(d.carrier, 'HFD');
    assert.equal(d.status, 'delivered');
    assert.equal(d.trackable, false);
    assert.equal((await u('ann').collection('shipments').doc(id).collection('trackingEvents').doc('e1').get()).exists, true);
  });

  it('deleting a shipment removes its events but not the order', async () => {
    const id = await createShipment(db, 'ann', { orderId: 'o1', trackingNumber: 'T2' });
    await u('ann').collection('shipments').doc(id).collection('trackingEvents').doc('e1').set({ description: 'x' });
    await deleteShipment(db, 'ann', id);
    assert.equal((await u('ann').collection('shipments').doc(id).get()).exists, false);
    assert.equal((await u('ann').collection('shipments').doc(id).collection('trackingEvents').doc('e1').get()).exists, false);
    assert.equal((await u('ann').collection('orders').doc('o1').get()).exists, true);
    await assert.rejects(deleteShipment(db, 'ben', id), NotFoundError);
  });
});
