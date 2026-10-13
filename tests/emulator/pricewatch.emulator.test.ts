import { strict as assert } from 'node:assert';
import { after, before, beforeEach, describe, it } from 'node:test';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { createNotification } from '../../api/_lib/notify';
import {
  IdentityMismatchError,
  ProductNotSavedError,
  recordObservation,
} from '../../api/_lib/priceService';

let app: App;
let db: Firestore;

before(() => {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  app = initializeApp({ projectId: 'demo-shupit' }, `price-${Date.now()}`);
  db = getFirestore(app);
});
after(async () => {
  await deleteApp(app);
});

const u = (uid: string) => db.collection('users').doc(uid);
const ils = (amountMinor: number) => ({ amountMinor, currency: 'ILS' });
const URL1 = 'https://www.nike.com/t/air-force-1';
const t0 = new Date('2026-10-14T10:00:00.000Z');
const at = (min: number) => new Date(t0.getTime() + min * 60_000);

async function seed(uid: string, sub: Record<string, unknown> | null = { enabled: true, minDropPercent: 5 }) {
  await db.recursiveDelete(u(uid));
  await u(uid).collection('savedProducts').doc('p1').set({
    id: 'p1',
    title: 'Nike Air Force 1 07 Mens Shoes',
    productUrl: URL1,
    urlKey: 'nike.com/t/air-force-1',
    merchantId: 'nike',
  });
  const subRef = db.collection('priceWatchSubscriptions').doc(`${uid}_p1`);
  if (sub) await subRef.set({ uid, savedProductId: 'p1', ...sub });
  else await subRef.delete();
}

const notifications = async (uid: string) => (await u(uid).collection('notifications').get()).docs.map((d) => d.data());

describe('manual price verification', () => {
  beforeEach(async () => {
    await seed('pw-ann');
    await seed('pw-ben');
  });

  it('refuses a page that is not one of the user’s saved products', async () => {
    await assert.rejects(
      recordObservation(db, 'pw-ann', { pageUrl: 'https://www.nike.com/t/other', price: ils(1) }, t0),
      ProductNotSavedError,
    );
  });

  it('records history, alerts once on a real drop, and does not repeat for the same price', async () => {
    const first = await recordObservation(db, 'pw-ann', { pageUrl: URL1, price: ils(10000) }, at(0));
    assert.equal(first.recorded, true);
    assert.deepEqual(first.alerts, []);

    const drop = await recordObservation(db, 'pw-ann', { pageUrl: URL1, price: ils(8000) }, at(120));
    assert.equal(drop.recorded, true);
    assert.equal(drop.dropPercent, 20);
    assert.deepEqual(drop.alerts.map((a) => `${a.type}:${a.result}`), ['price_drop:created']);

    const same = await recordObservation(db, 'pw-ann', { pageUrl: URL1, price: ils(8000) }, at(125));
    assert.equal(same.recorded, false);
    assert.equal(same.reason, 'unchanged');

    const ns = await notifications('pw-ann');
    assert.equal(ns.length, 1);
    assert.equal(ns[0]!.type, 'price_drop');
    assert.equal(ns[0]!.readAt, null);

    const hist = await u('pw-ann').collection('savedProducts').doc('p1').collection('priceObservations').get();
    assert.equal(hist.size, 2);
    const product = (await u('pw-ann').collection('savedProducts').doc('p1').get()).data()!;
    assert.equal(product.latestObservation.price.amountMinor, 8000);
  });

  it('reaches a target price once', async () => {
    await seed('pw-ann', { enabled: true, minDropPercent: 50, targetPrice: ils(9000) });
    await recordObservation(db, 'pw-ann', { pageUrl: URL1, price: ils(10000) }, at(0));
    const hit = await recordObservation(db, 'pw-ann', { pageUrl: URL1, price: ils(8900) }, at(200));
    assert.deepEqual(hit.alerts.map((a) => a.type), ['target_reached']);
    const again = await recordObservation(db, 'pw-ann', { pageUrl: URL1, price: ils(8900) }, at(500));
    assert.deepEqual(again.alerts, []);
  });

  it('respects notification preferences (disabled types are not stored)', async () => {
    await u('pw-ann').collection('preferences').doc('notifications').set({ priceDrops: false });
    await recordObservation(db, 'pw-ann', { pageUrl: URL1, price: ils(10000) }, at(0));
    const r = await recordObservation(db, 'pw-ann', { pageUrl: URL1, price: ils(7000) }, at(120));
    assert.deepEqual(r.alerts.map((a) => `${a.type}:${a.result}`), ['price_drop:disabled']);
    assert.equal((await notifications('pw-ann')).length, 0);
  });

  it('records but never alerts without an enabled subscription', async () => {
    await seed('pw-ann', null);
    await recordObservation(db, 'pw-ann', { pageUrl: URL1, price: ils(10000) }, at(0));
    const r = await recordObservation(db, 'pw-ann', { pageUrl: URL1, price: ils(5000) }, at(120));
    assert.equal(r.recorded, true);
    assert.equal(r.reason, 'no_subscription');
    assert.equal((await notifications('pw-ann')).length, 0);
  });

  it('AI-read prices are recorded as unverified and never alert', async () => {
    await recordObservation(db, 'pw-ann', { pageUrl: URL1, price: ils(10000) }, at(0));
    const r = await recordObservation(db, 'pw-ann', { pageUrl: URL1, price: ils(1000), aiRead: true }, at(120));
    assert.equal(r.kind, 'page_ai');
    assert.deepEqual(r.alerts, []);
    // …and an unverified price is not used as the baseline for the next verified one.
    const next = await recordObservation(db, 'pw-ann', { pageUrl: URL1, price: ils(9000) }, at(300));
    assert.equal(next.comparedWith?.amountMinor, 10000);
  });

  it('asks for confirmation when the page title does not match the saved product', async () => {
    await assert.rejects(
      recordObservation(db, 'pw-ann', { pageUrl: URL1, price: ils(10000), pageTitle: 'Sony WH-1000XM5 Headphones' }, at(0)),
      IdentityMismatchError,
    );
    const ok = await recordObservation(
      db,
      'pw-ann',
      { pageUrl: URL1, price: ils(10000), pageTitle: 'Sony WH-1000XM5 Headphones', confirmed: true },
      at(0),
    );
    assert.equal(ok.recorded, true);
  });

  it('keeps users separate', async () => {
    await recordObservation(db, 'pw-ann', { pageUrl: URL1, price: ils(10000) }, at(0));
    await recordObservation(db, 'pw-ann', { pageUrl: URL1, price: ils(5000) }, at(120));
    assert.equal((await notifications('pw-ben')).length, 0);
    const benHist = await u('pw-ben').collection('savedProducts').doc('p1').collection('priceObservations').get();
    assert.equal(benHist.size, 0);
  });
});

describe('notification engine', () => {
  it('is idempotent per dedupe key', async () => {
    await db.recursiveDelete(u('pw-cy'));
    const draft = { type: 'shipment_status' as const, status: 'delivered', dedupeKey: 's1:status:delivered', data: { shipmentId: 's1' } };
    assert.equal(await createNotification(db, 'pw-cy', draft), 'created');
    assert.equal(await createNotification(db, 'pw-cy', draft), 'duplicate');
    assert.equal((await notifications('pw-cy')).length, 1);
  });

  it('maps statuses to the right preference switch', async () => {
    await db.recursiveDelete(u('pw-di'));
    await u('pw-di').collection('preferences').doc('notifications').set({ readyForPickup: false, deliveryExceptions: false });
    const mk = (status: string) => ({
      type: 'shipment_status' as const,
      status,
      dedupeKey: `s:${status}`,
      data: {},
    });
    assert.equal(await createNotification(db, 'pw-di', mk('ready_for_pickup')), 'disabled');
    assert.equal(await createNotification(db, 'pw-di', mk('exception')), 'disabled');
    assert.equal(await createNotification(db, 'pw-di', mk('delivered')), 'created');
  });
});
