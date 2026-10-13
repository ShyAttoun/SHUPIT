import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { getMerchant } from '@shupit/contracts';
import { resolveDestination, urlBelongsToMerchant, type AffiliateProgram } from '../api/_lib/affiliate';
import { fetchPageHtml, parseProductHtml } from '../api/_lib/extract';
import { assertPublicHttpUrl, isPrivateAddress, UnsafeUrlError } from '../api/_lib/ssrf';
import { orderDedupeKey } from '../api/_lib/orderKeys';

const html = `<!doctype html><html><head>
<title>Fallback title</title>
<meta property="og:title" content="Desk Lamp &amp; Light">
<meta property="og:image" content="/img/lamp.jpg">
<meta property="og:url" content="https://www.ksp.co.il/p/1?utm_source=x">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Desk Lamp","image":["https://cdn.ksp.co.il/lamp.jpg"],"offers":{"@type":"Offer","price":"1,299.90","priceCurrency":"ils"}}</script>
</head><body></body></html>`;

test('parseProductHtml prefers JSON-LD and normalizes price to minor units', () => {
  const d = parseProductHtml(html, 'https://www.ksp.co.il/p/1');
  assert.equal(d.title, 'Desk Lamp');
  assert.equal(d.imageUrl, 'https://cdn.ksp.co.il/lamp.jpg');
  assert.deepEqual(d.price, { amountMinor: 129990, currency: 'ILS' });
  assert.equal(d.merchantId, 'ksp');
  assert.deepEqual(d.missing, []);
});

test('parseProductHtml reports missing fields instead of inventing them', () => {
  const d = parseProductHtml('<html><head></head><body>hi</body></html>', 'https://unknown-shop.example/x');
  assert.equal(d.title, undefined);
  assert.equal(d.price, undefined);
  assert.deepEqual(d.missing, ['title', 'imageUrl', 'price']);
  assert.equal(d.canonicalUrl, 'https://unknown-shop.example/x');
});

test('price without a currency is not accepted', () => {
  const d = parseProductHtml('<meta property="product:price:amount" content="10">', 'https://shop.example/a');
  assert.equal(d.price, undefined);
});

test('canonical URL on another domain is ignored', () => {
  const page = '<meta property="og:url" content="https://evil.example/steal"><title>x</title>';
  const d = parseProductHtml(page, 'https://www.amazon.com/dp/1');
  assert.equal(d.canonicalUrl, 'https://www.amazon.com/dp/1');
});

test('isPrivateAddress', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.1.1', '172.16.0.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:10.0.0.1', '100.64.0.1']) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) {
    assert.equal(isPrivateAddress(ip), false, ip);
  }
});

test('assertPublicHttpUrl blocks unsafe targets', async () => {
  const pub = async () => ['93.184.216.34'];
  const priv = async () => ['10.0.0.5'];
  await assert.rejects(assertPublicHttpUrl('file:///etc/passwd', pub), UnsafeUrlError);
  await assert.rejects(assertPublicHttpUrl('http://user:pw@example.com', pub), UnsafeUrlError);
  await assert.rejects(assertPublicHttpUrl('http://internal.example', priv), UnsafeUrlError);
  await assert.rejects(assertPublicHttpUrl('http://127.0.0.1:8080', pub), UnsafeUrlError);
  await assert.rejects(assertPublicHttpUrl('http://[::1]/', pub), UnsafeUrlError);
  const ok = await assertPublicHttpUrl('https://example.com/p', pub);
  assert.equal(ok.hostname, 'example.com');
});

test('fetchPageHtml refuses redirects to private addresses', async () => {
  const fakeFetch = (async () =>
    new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest' } })) as typeof fetch;
  await assert.rejects(fetchPageHtml('http://8.8.8.8/start', fakeFetch), UnsafeUrlError);
});

test('affiliate: no program → original URL, never claims affiliate', () => {
  const amazon = getMerchant('amazon')!;
  const r = resolveDestination(amazon, 'https://www.amazon.com/dp/1');
  assert.deepEqual(r, { url: 'https://www.amazon.com/dp/1', kind: 'web' });
});

test('affiliate: only approved programs are used', () => {
  const merchant = { ...getMerchant('amazon')!, affiliateProgramId: 'p' };
  const program: AffiliateProgram = {
    id: 'p', status: 'approved', urlTemplate: 'https://track.example/?u={url}', disclosure: 'We may earn a commission.',
  };
  const ok = resolveDestination(merchant, 'https://www.amazon.com/dp/1', { p: program });
  assert.equal(ok.kind, 'affiliate');
  assert.equal(ok.url, 'https://track.example/?u=https%3A%2F%2Fwww.amazon.com%2Fdp%2F1');
  assert.ok(ok.disclosure);
  const pending = resolveDestination(merchant, undefined, { p: { ...program, status: 'pending' } });
  assert.equal(pending.kind, 'web');
});

test('urlBelongsToMerchant rejects other domains', () => {
  const amazon = getMerchant('amazon')!;
  assert.equal(urlBelongsToMerchant(amazon, 'https://www.amazon.com/x'), true);
  assert.equal(urlBelongsToMerchant(amazon, 'https://evil.com/amazon.com'), false);
});

test('orderDedupeKey is conservative', () => {
  const base = { merchantName: 'KSP', items: [], shipments: [] };
  assert.equal(orderDedupeKey({ ...base }), undefined);
  assert.equal(
    orderDedupeKey({ ...base, merchantId: 'ksp', externalOrderId: '#12-34 ' }),
    'ksp:1234',
  );
});
