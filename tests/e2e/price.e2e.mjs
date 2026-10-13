// Live journey: save a product → enable tracking → verify prices → alerts → read/unread → preferences.
// Usage: FIREBASE_WEB_API_KEY=... node tests/e2e/price.e2e.mjs [baseUrl]
const BASE = process.argv[2] ?? 'https://shupit.vercel.app';
const KEY = process.env.FIREBASE_WEB_API_KEY;
const PROJECT = process.env.FIREBASE_PROJECT_ID ?? 'shupit-8a4f5';
if (!KEY) {
  console.error('FIREBASE_WEB_API_KEY is required');
  process.exit(2);
}
const results = [];
const check = (name, ok, extra = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
};
const idt = (p, b) =>
  fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${p}?key=${KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(b),
  }).then((r) => r.json());

const su = await idt('signUp', {
  email: `shupit-price-${Date.now()}@example.com`,
  password: 'Pr-' + Math.random().toString(36).slice(2) + 'Aa1!',
  returnSecureToken: true,
});
const token = su.idToken;
const uid = su.localId;
const api = async (method, path, body) => {
  const r = await fetch(BASE + path, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const fs = async (method, path, body, mask = '') => {
  const r = await fetch(`${FS}/${path}${mask}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const str = (v) => ({ stringValue: v });
const num = (v) => ({ integerValue: String(v) });

try {
  const URL1 = 'https://www.nike.com/t/air-force-1-07-mens-shoes';
  let r = await api('POST', '/api/products', {
    title: 'Nike Air Force 1 07 Mens Shoes',
    productUrl: URL1,
    price: { amountMinor: 53900, currency: 'ILS' },
    merchantId: 'nike',
  });
  check('save product', r.status === 201);
  const productId = r.json?.id;

  r = await api('POST', '/api/price-observations', { pageUrl: 'https://www.nike.com/t/not-saved', price: { amountMinor: 1, currency: 'ILS' } });
  check('page that is not a saved product is refused (404)', r.status === 404 && r.json?.error?.code === 'product_not_saved');

  r = await api('POST', '/api/price-observations', {
    pageUrl: URL1,
    price: { amountMinor: 53900, currency: 'ILS' },
    pageTitle: 'Sony WH-1000XM5 Headphones',
  });
  check('different product title needs confirmation (409)', r.status === 409 && r.json?.error?.code === 'identity_mismatch');

  // Enable tracking from the client side (same Firestore write the app performs).
  r = await fs('PATCH', `priceWatchSubscriptions/${uid}_${productId}`, {
    fields: { id: str(`${uid}_${productId}`), uid: str(uid), savedProductId: str(productId), enabled: { booleanValue: true }, minDropPercent: num(5) },
  });
  check('enable price tracking (client write allowed)', r.status === 200);

  r = await api('POST', '/api/price-observations', { pageUrl: URL1, price: { amountMinor: 53900, currency: 'ILS' } });
  check('first verification is recorded without alerts', r.status === 200 && r.json?.recorded === true && r.json?.alerts?.length === 0);

  r = await api('POST', '/api/price-observations', { pageUrl: URL1, price: { amountMinor: 44900, currency: 'ILS' } });
  check('a real drop is recorded and raises one alert', r.status === 200 && r.json?.alerts?.length === 1 && r.json.alerts[0].type === 'price_drop' && Math.round(r.json.dropPercent) === 17, JSON.stringify(r.json?.alerts));

  r = await api('POST', '/api/price-observations', { pageUrl: URL1, price: { amountMinor: 44900, currency: 'ILS' } });
  check('same price again is not stored twice', r.status === 200 && r.json?.recorded === false && r.json?.reason === 'unchanged');

  // in-app notification exists and is unread; owner can mark it read
  r = await fs('GET', `users/${uid}/notifications`);
  const docs = r.json?.documents ?? [];
  check('notification stored, unread', docs.length === 1 && docs[0].fields?.type?.stringValue === 'price_drop' && docs[0].fields?.readAt?.nullValue !== undefined);
  const nPath = docs[0]?.name?.split('/documents/')[1];

  r = await fs('PATCH', nPath, { fields: { readAt: str(new Date().toISOString()) } }, '?updateMask.fieldPaths=readAt');
  check('owner can mark a notification read', r.status === 200);
  r = await fs('PATCH', nPath, { fields: { type: str('hacked') } }, '?updateMask.fieldPaths=type');
  check('owner cannot rewrite notification content', r.status === 403);

  // price history is readable by the owner, not writable
  r = await fs('GET', `users/${uid}/savedProducts/${productId}/priceObservations`);
  check('verified price history is readable (2 points)', r.status === 200 && (r.json?.documents ?? []).length === 2);
  r = await fs('PATCH', `users/${uid}/savedProducts/${productId}/priceObservations/forged`, { fields: { kind: str('page') } });
  check('price history cannot be forged by the client', r.status === 403);

  // preferences: turn price drops off → next drop is not stored
  r = await fs('PATCH', `users/${uid}/preferences/notifications`, { fields: { priceDrops: { booleanValue: false } } });
  check('set notification preference', r.status === 200);
  r = await api('POST', '/api/price-observations', { pageUrl: URL1, price: { amountMinor: 39900, currency: 'ILS' } });
  check('disabled alert type is not created', r.status === 200 && r.json?.alerts?.[0]?.result === 'disabled');
  r = await fs('GET', `users/${uid}/notifications`);
  check('still only the first notification exists', (r.json?.documents ?? []).length === 1);

  // deleting the product removes its price history
  r = await api('DELETE', `/api/products?id=${productId}`);
  check('delete product (cascade)', r.status === 200);
  r = await fs('GET', `users/${uid}/savedProducts/${productId}/priceObservations`);
  check('price history is gone with the product', (r.json?.documents ?? []).length === 0);
} finally {
  await api('POST', '/api/account/delete').catch(() => undefined);
}
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
