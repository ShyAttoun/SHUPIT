import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { extractedOrder, extractRequest, merchantByName } from '@shupit/contracts';
import { firstJsonObject } from '../api/_lib/vision';

test('firstJsonObject extracts JSON surrounded by prose and handles braces in strings', () => {
  const v = firstJsonObject('Here you go:\n{"a": "x}y", "b": {"c": 1}}\nThanks') as { a: string; b: { c: number } };
  assert.equal(v.a, 'x}y');
  assert.equal(v.b.c, 1);
});

test('firstJsonObject throws when there is no object', () => {
  assert.throws(() => firstJsonObject('no json here'));
  assert.throws(() => firstJsonObject('{"a": 1'));
});

test('extractedOrder accepts nulls and turns invented date formats into null', () => {
  const ok = extractedOrder.safeParse({
    isOrderScreenshot: true,
    merchantName: 'KSP',
    orderNumber: null,
    purchaseDate: '2026-10-01',
    total: { amount: 99.9, currency: 'ILS' },
    items: [{ title: 'Cable', quantity: 1 }],
    shipments: [{ carrier: null, trackingNumber: 'RR1', estimatedDelivery: null }],
    confidence: 'high',
  });
  assert.equal(ok.success, true);
  const bad = extractedOrder.safeParse({
    isOrderScreenshot: true, merchantName: null, orderNumber: null, purchaseDate: '01/10/2026',
    total: null, items: [], shipments: [], confidence: 'high',
  });
  assert.equal(bad.success, true);
  assert.equal(bad.success && bad.data.purchaseDate, null);
});

test('extractRequest needs an image with media type, or a url', () => {
  assert.equal(extractRequest.safeParse({ kind: 'order' }).success, false);
  assert.equal(extractRequest.safeParse({ kind: 'order', imageBase64: 'abc' }).success, false);
  assert.equal(extractRequest.safeParse({ kind: 'order', imageBase64: 'abc', mediaType: 'image/png' }).success, true);
  assert.equal(extractRequest.safeParse({ kind: 'order', url: 'https://x.test/o/1' }).success, true);
});

test('merchantByName matches case-insensitively', () => {
  assert.equal(merchantByName(' ksp ')?.id, 'ksp');
  assert.equal(merchantByName('Unknown Shop'), undefined);
  assert.equal(merchantByName(null), undefined);
});

test('a malformed optional value does not discard the whole read', () => {
  const r = extractedOrder.safeParse({
    isOrderScreenshot: true,
    merchantName: 'SHEIN',
    orderNumber: 'G1',
    purchaseDate: 'yesterday',
    total: { amount: 10, currency: 'shekel' },
    items: [{ title: 'Shirt', quantity: 1 }],
    shipments: [
      {
        carrier: 'HFD',
        trackingNumber: '1',
        status: 'pending',
        estimatedDelivery: '2026-13-99-nope',
        events: [
          { description: 'Arrived', occurredAt: '2026-10-13T16:46' },
          { description: 'Bad date', occurredAt: 'last tuesday' },
          { occurredAt: '2026-10-12' },
        ],
      },
    ],
    confidence: 'medium',
  });
  assert.equal(r.success, true);
  if (!r.success) return;
  assert.equal(r.data.purchaseDate, null);
  assert.equal(r.data.total, null);
  assert.equal(r.data.shipments[0]!.status, null);
  assert.deepEqual(r.data.shipments[0]!.events, [{ description: 'Arrived', occurredAt: '2026-10-13T16:46' }]);
});
