import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { sanitizeOrderUrl } from '../api/_lib/orderUrl';

test('keeps the https order page of the same store, drops the fragment', () => {
  assert.equal(
    sanitizeOrderUrl('https://www.aliexpress.com/p/order/detail.html?orderId=123#top', 'aliexpress'),
    'https://www.aliexpress.com/p/order/detail.html?orderId=123',
  );
});

test('rejects other stores, http, credentials and token-like links', () => {
  assert.equal(sanitizeOrderUrl('https://www.amazon.com/orders/1', 'aliexpress'), null);
  assert.equal(sanitizeOrderUrl('http://www.aliexpress.com/orders/1', 'aliexpress'), null);
  assert.equal(sanitizeOrderUrl('https://user:pw@www.aliexpress.com/o', 'aliexpress'), null);
  assert.equal(sanitizeOrderUrl('https://www.aliexpress.com/o?token=abc', 'aliexpress'), null);
  assert.equal(sanitizeOrderUrl('not a url', 'aliexpress'), null);
  assert.equal(sanitizeOrderUrl(undefined, 'aliexpress'), null);
});

test('without a known merchant any https page without secrets is allowed', () => {
  assert.equal(sanitizeOrderUrl('https://small-shop.example/orders/9', null), 'https://small-shop.example/orders/9');
});
