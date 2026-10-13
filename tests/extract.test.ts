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

test('extractedOrder accepts nulls and rejects invented formats', () => {
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
  assert.equal(bad.success, false);
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
