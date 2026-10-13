import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { prefKeyFor, titleSimilarity, priceObservationRequest } from '@shupit/contracts';
import { evaluateObservation, pickComparable, variantKeyOf, type PreviousObservation } from '../api/_lib/priceWatch';

const ils = (amountMinor: number) => ({ amountMinor, currency: 'ILS' });
const obs = (amountMinor: number, kind: PreviousObservation['kind'] = 'page', variantKey = ''): PreviousObservation => ({
  price: ils(amountMinor),
  kind,
  variantKey,
});
const sub = { enabled: true, minDropPercent: 5, targetPrice: null };

test('a drop above the threshold raises one price_drop alert with a stable key', () => {
  const e = evaluateObservation({
    history: [obs(10000)],
    next: { price: ils(8000), kind: 'page', variantKey: '' },
    subscription: sub,
    productId: 'p1',
  });
  assert.equal(e.alerts.length, 1);
  assert.equal(e.alerts[0]!.type, 'price_drop');
  assert.equal((e.alerts[0] as { dropPercent: number }).dropPercent, 20);
  assert.equal(e.alerts[0]!.dedupeKey, 'p1:drop:8000:ILS');
});

test('a drop below the threshold, an increase, or no change raises nothing', () => {
  for (const next of [9800, 12000, 10000]) {
    const e = evaluateObservation({
      history: [obs(10000)],
      next: { price: ils(next), kind: 'page', variantKey: '' },
      subscription: sub,
      productId: 'p1',
    });
    assert.deepEqual(e.alerts, [], `next=${next}`);
  }
});

test('target price is raised when crossed, once, instead of a second drop alert', () => {
  const s = { enabled: true, minDropPercent: 5, targetPrice: ils(9000) };
  const crossed = evaluateObservation({
    history: [obs(10000)],
    next: { price: ils(8500), kind: 'page', variantKey: '' },
    subscription: s,
    productId: 'p1',
  });
  assert.deepEqual(crossed.alerts.map((a) => a.type), ['target_reached']);
  // already below target on the previous visit → not a new crossing; a further real drop still alerts as a drop
  const further = evaluateObservation({
    history: [obs(8500)],
    next: { price: ils(7000), kind: 'page', variantKey: '' },
    subscription: s,
    productId: 'p1',
  });
  assert.deepEqual(further.alerts.map((a) => a.type), ['price_drop']);
});

test('first observation has nothing to compare, but can still reach a target', () => {
  const first = evaluateObservation({
    history: [],
    next: { price: ils(9500), kind: 'page', variantKey: '' },
    subscription: sub,
    productId: 'p1',
  });
  assert.equal(first.reason, 'no_previous');
  assert.deepEqual(first.alerts, []);
  const atTarget = evaluateObservation({
    history: [],
    next: { price: ils(8000), kind: 'page', variantKey: '' },
    subscription: { enabled: true, targetPrice: ils(9000), minDropPercent: 5 },
    productId: 'p1',
  });
  assert.deepEqual(atTarget.alerts.map((a) => a.type), ['target_reached']);
});

test('AI-read, screenshot and user prices never alert; unverified history is not a baseline', () => {
  for (const kind of ['page_ai', 'screenshot', 'user'] as const) {
    const e = evaluateObservation({
      history: [obs(10000)],
      next: { price: ils(5000), kind, variantKey: '' },
      subscription: sub,
      productId: 'p1',
    });
    assert.deepEqual(e.alerts, [], kind);
    assert.equal(e.reason, 'not_alertable');
  }
  assert.equal(pickComparable([obs(10000, 'user'), obs(9000, 'screenshot')], ''), null);
});

test('different variant or currency is never compared', () => {
  const diffVariant = evaluateObservation({
    history: [obs(10000, 'page', 'size m')],
    next: { price: ils(5000), kind: 'page', variantKey: 'size l' },
    subscription: sub,
    productId: 'p1',
  });
  assert.deepEqual(diffVariant.alerts, []);
  assert.equal(diffVariant.reason, 'no_previous');

  const usd = evaluateObservation({
    history: [{ price: { amountMinor: 10000, currency: 'USD' }, kind: 'page', variantKey: '' }],
    next: { price: ils(5000), kind: 'page', variantKey: '' },
    subscription: sub,
    productId: 'p1',
  });
  assert.deepEqual(usd.alerts, []);
  assert.equal(usd.reason, 'currency_mismatch');
});

test('no alerts without an enabled subscription', () => {
  for (const s of [null, { enabled: false }]) {
    const e = evaluateObservation({
      history: [obs(10000)],
      next: { price: ils(5000), kind: 'page', variantKey: '' },
      subscription: s,
      productId: 'p1',
    });
    assert.deepEqual(e.alerts, []);
    assert.equal(e.reason, 'no_subscription');
    assert.equal(e.dropPercent, 50);
  }
});

test('variant keys normalize case and spacing', () => {
  assert.equal(variantKeyOf('  Size  M '), 'size m');
  assert.equal(variantKeyOf(undefined), '');
});

test('preferences map notification kinds to the right switch', () => {
  assert.equal(prefKeyFor('price_drop'), 'priceDrops');
  assert.equal(prefKeyFor('target_reached'), 'targetReached');
  assert.equal(prefKeyFor('shipment_status', 'ready_for_pickup'), 'readyForPickup');
  assert.equal(prefKeyFor('shipment_status', 'exception'), 'deliveryExceptions');
  assert.equal(prefKeyFor('shipment_status', 'in_transit'), 'shipmentStatus');
  assert.equal(prefKeyFor('shipment_eta'), 'shipmentStatus');
});

test('title similarity separates the same product from a different one', () => {
  assert.ok(titleSimilarity('Nike Air Force 1 07 Mens Shoes', 'Nike Air Force 1 07 - Men Shoes') > 0.5);
  assert.ok(titleSimilarity('Nike Air Force 1', 'Sony WH-1000XM5 Headphones') < 0.1);
  assert.equal(titleSimilarity('', 'x y'), 0);
});

test('observation request validates price and url', () => {
  assert.equal(priceObservationRequest.safeParse({ pageUrl: 'https://x.test/p', price: ils(100) }).success, true);
  assert.equal(priceObservationRequest.safeParse({ pageUrl: 'nope', price: ils(100) }).success, false);
  assert.equal(
    priceObservationRequest.safeParse({ pageUrl: 'https://x.test/p', price: { amountMinor: -1, currency: 'ILS' } }).success,
    false,
  );
});
