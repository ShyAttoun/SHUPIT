import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { captureRequest, saveProductRequest } from '@shupit/contracts';
import { parseProductHtml } from '../api/_lib/extract';
import { htmlFromCapture } from '../api/_lib/page';

test('captured structured data round-trips through the same parser', () => {
  const html = htmlFromCapture({
    url: 'https://www.ksp.co.il/web/item/1',
    title: 'Fallback',
    metas: { 'og:image': 'https://cdn.ksp.co.il/a.jpg' },
    jsonLd: ['{"@type":"Product","name":"Desk \\"Lamp\\" </script>","offers":{"price":"99.90","priceCurrency":"ILS"}}'],
  });
  const d = parseProductHtml(html, 'https://www.ksp.co.il/web/item/1');
  assert.equal(d.title, 'Desk "Lamp" </script>');
  assert.deepEqual(d.price, { amountMinor: 9990, currency: 'ILS' });
  assert.equal(d.imageUrl, 'https://cdn.ksp.co.il/a.jpg');
  assert.equal(d.merchantId, 'ksp');
});

test('attribute injection in metas is escaped', () => {
  const html = htmlFromCapture({ url: 'https://shop.example/p', metas: { 'og:title': '"><script>alert(1)</script>' } });
  assert.ok(!html.includes('<script>alert'));
});

test('captureRequest bounds text and requires a valid url', () => {
  assert.equal(captureRequest.safeParse({ kind: 'order', page: { url: 'not a url' } }).success, false);
  assert.equal(
    captureRequest.safeParse({ kind: 'order', page: { url: 'https://x.test', text: 'a'.repeat(30_001) } }).success,
    false,
  );
  assert.equal(captureRequest.safeParse({ kind: 'product', page: { url: 'https://x.test', text: 'ok' } }).success, true);
});

test('saveProductRequest validates currency and url', () => {
  assert.equal(
    saveProductRequest.safeParse({ title: 'x', productUrl: 'https://x.test/p', price: { amountMinor: 100, currency: 'ils' } }).success,
    false,
  );
  assert.equal(saveProductRequest.safeParse({ title: 'x', productUrl: 'https://x.test/p' }).success, true);
});
