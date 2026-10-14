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
  merchantMatchesQuery,
  merchantsForPicker,
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

test('without a provider the price is verified manually, never "active"', () => {
  assert.equal(monitoringAvailability(getMerchant('amazon')), 'manual');
  assert.equal(monitoringAvailability(undefined), 'manual');
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

const ORIGINAL_21 = [
  'amazon', 'aliexpress', 'shein', 'temu', 'ebay', 'etsy', 'iherb', 'asos', 'zara', 'hm', 'nike', 'adidas',
  'ikea', 'apple', 'ksp', 'ivory', 'terminalx', 'castro', 'fox', 'superpharm', 'zer4u',
];

test('expanded catalog: 61 unique merchants, original 21 preserved in order', () => {
  assert.equal(merchantCatalog.length, 61);
  assert.deepEqual(merchantCatalog.slice(0, 21).map((x) => x.id), ORIGINAL_21);
  assert.equal(new Set(merchantCatalog.map((x) => x.id)).size, 61);
});

test('no two merchants share a normalized domain', () => {
  const seen = new Map<string, string>();
  for (const x of merchantCatalog) {
    for (const d of x.domains) {
      const key = d.toLowerCase().replace(/^www\./, '');
      assert.ok(!seen.has(key), `${key} is used by both ${seen.get(key)} and ${x.id}`);
      seen.set(key, x.id);
    }
  }
});

test('new merchants use web routing and explicitly have no affiliate program', () => {
  const added = merchantCatalog.slice(21);
  assert.equal(added.length, 40);
  for (const x of added) {
    assert.deepEqual(x.routing, ['web'], x.id);
    assert.equal(x.affiliateProgramId, null, x.id);
    assert.ok(x.category, `${x.id} has a category`);
    assert.ok(x.market === 'il' || x.market === 'global', x.id);
  }
});

test('search matches Hebrew aliases and domains; Hebrew picker lists Israeli stores first', () => {
  const payngo = getMerchant('payngo')!;
  assert.ok(merchantMatchesQuery(payngo, 'מחסני'));
  assert.ok(merchantMatchesQuery(payngo, 'payngo'));
  assert.ok(!merchantMatchesQuery(payngo, 'nike'));
  const he = merchantsForPicker('he');
  const firstGlobal = he.findIndex((x) => x.market !== 'il');
  assert.ok(he.slice(0, firstGlobal).every((x) => x.market === 'il'));
  assert.ok(he.slice(firstGlobal).every((x) => x.market !== 'il'));
  assert.equal(merchantsForPicker('en'), merchantCatalog);
});

test('new domains resolve to the right merchant, lookalikes do not', () => {
  assert.equal(merchantForUrl('https://www.payngo.co.il/p/1')?.id, 'payngo');
  assert.equal(merchantForUrl('https://shop.mango.com/il/women')?.id, 'mango');
  assert.equal(merchantForUrl('https://www.next.co.uk/style/x')?.id, 'next');
  assert.equal(merchantForUrl('https://evilnext.co.uk/'), undefined);
});
