import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  formatMoney,
  merchantCatalog,
  merchantForUrl,
  monitoringAvailability,
  normalizeProductUrl,
  orderCreateInput,
  parsePriceNumber,
  toMinor,
  getMerchant,
} from './index';

test('normalizeProductUrl strips tracking, hash, www and trailing slash', () => {
  const a = normalizeProductUrl('https://www.Shop.com/p/123/?utm_source=x&color=red&fbclid=1#top');
  const b = normalizeProductUrl('https://shop.com/p/123?color=red');
  assert.equal(a, 'shop.com/p/123?color=red');
  assert.equal(a, b);
});

test('normalizeProductUrl rejects non-http', () => {
  assert.equal(normalizeProductUrl('javascript:alert(1)'), null);
  assert.equal(normalizeProductUrl('not a url'), null);
});

test('merchantForUrl matches domain and subdomain but not lookalikes', () => {
  assert.equal(merchantForUrl('https://www.amazon.com/dp/B0')?.id, 'amazon');
  assert.equal(merchantForUrl('https://smile.amazon.com/dp/B0')?.id, 'amazon');
  assert.equal(merchantForUrl('https://notamazon.com/dp/B0'), undefined);
  assert.equal(merchantForUrl('https://amazon.com.evil.io/'), undefined);
});

test('catalog ids unique, none claims affiliate or price provider', () => {
  const ids = new Set(merchantCatalog.map((m) => m.id));
  assert.equal(ids.size, merchantCatalog.length);
  assert.ok(merchantCatalog.every((m) => !m.affiliateProgramId && !m.priceProviderId));
});

test('monitoring is unavailable without a provider', () => {
  assert.equal(monitoringAvailability(getMerchant('amazon')), 'unsupported_merchant');
  assert.equal(monitoringAvailability(undefined), 'unsupported_merchant');
  assert.equal(
    monitoringAvailability({ ...getMerchant('amazon')!, priceProviderId: 'p1' }),
    'active',
  );
});

test('parsePriceNumber handles locales', () => {
  assert.equal(parsePriceNumber('1,299.90'), 1299.9);
  assert.equal(parsePriceNumber('1.299,90'), 1299.9);
  assert.equal(parsePriceNumber('12,50'), 12.5);
  assert.equal(parsePriceNumber('₪89'), 89);
  assert.equal(parsePriceNumber('1,299'), 1299);
  assert.equal(parsePriceNumber('abc'), null);
  assert.equal(parsePriceNumber('-5'), null);
});

test('money minor units respect currency exponent', () => {
  assert.equal(toMinor(12.34, 'ILS'), 1234);
  assert.equal(toMinor(500, 'JPY'), 500);
  assert.match(formatMoney({ amountMinor: 1234, currency: 'USD' }, 'en'), /12\.34/);
});

test('orderCreateInput validates and rejects junk', () => {
  const ok = orderCreateInput.safeParse({
    merchantName: 'KSP',
    items: [{ title: 'Cable', quantity: 1 }],
    shipments: [{ carrier: 'Israel Post', trackingNumber: 'RR123' }],
  });
  assert.equal(ok.success, true);
  const bad = orderCreateInput.safeParse({ merchantName: '', items: [], shipments: [] });
  assert.equal(bad.success, false);
});
