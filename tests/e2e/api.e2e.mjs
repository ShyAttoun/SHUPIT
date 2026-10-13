// Live API journey checks against a deployed URL. Creates and deletes throwaway accounts.
// Usage: FIREBASE_WEB_API_KEY=... node tests/e2e/api.e2e.mjs [baseUrl]
const BASE = process.argv[2] ?? 'https://shupit.vercel.app';
const KEY = process.env.FIREBASE_WEB_API_KEY;
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

async function newUser(tag) {
  const email = `shupit-e2e-${tag}-${Date.now()}@example.com`;
  const password = 'E2e-' + Math.random().toString(36).slice(2) + 'Aa1!';
  const su = await idt('signUp', { email, password, returnSecureToken: true });
  const call = async (method, path, body) => {
    const r = await fetch(BASE + path, {
      method,
      headers: { authorization: `Bearer ${su.idToken}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // not json
    }
    return { status: r.status, json };
  };
  return { call, uid: su.localId, destroy: () => idt('delete', { idToken: su.idToken }) };
}

const A = await newUser('a');
const B = await newUser('b');
try {
  // ---- orders: create, edit, duplicate
  let r = await A.call('POST', '/api/orders', {
    merchantName: 'KSP',
    externalOrderId: 'E2E-100',
    items: [{ title: 'Cable', quantity: 1 }],
    shipments: [{ carrier: 'HFD', trackingNumber: 'T-100' }],
  });
  check('create order', r.status === 201);
  const orderId = r.json?.id;
  const firstShipment = r.json?.shipmentIds?.[0];

  r = await A.call('PUT', `/api/orders?id=${orderId}`, { total: { amountMinor: 12900, currency: 'ILS' } });
  check('edit order', r.status === 200);

  r = await A.call('POST', '/api/orders', { merchantName: 'KSP', externalOrderId: 'E2E-200', items: [], shipments: [] });
  const second = r.json?.id;
  r = await A.call('PUT', `/api/orders?id=${second}`, { externalOrderId: 'E2E-100' });
  check('editing into an existing order number is refused (409)', r.status === 409 && !!r.json?.existingId);

  // ---- shipments: add (with pickup), edit, delete
  r = await A.call('POST', '/api/shipments', {
    orderId,
    carrier: 'Israel Post',
    status: 'ready_for_pickup',
    pickup: { name: 'Locker 12', address: 'Herzl 1', code: '4821' },
  });
  check('add a second shipment with pickup details', r.status === 201);
  const shipId = r.json?.id;

  r = await A.call('PUT', `/api/shipments?id=${shipId}`, { trackingNumber: 'T-777', status: 'delivered' });
  check('edit shipment', r.status === 200);

  r = await A.call('GET', '/api/shipments-list');
  const ids = (r.json?.shipments ?? []).map((s) => s.id);
  check('delivered shipment leaves the active list', r.status === 200 && !ids.includes(shipId) && ids.includes(firstShipment));

  r = await A.call('DELETE', `/api/shipments?id=${shipId}`);
  check('delete shipment', r.status === 200);

  // ---- isolation: B cannot read or change A's data
  r = await B.call('PUT', `/api/orders?id=${orderId}`, { merchantName: 'Hijack' });
  check('another user cannot edit my order (404)', r.status === 404);
  r = await B.call('POST', '/api/shipments', { orderId, carrier: 'X' });
  check('another user cannot add a shipment to my order (404)', r.status === 404);
  r = await B.call('PUT', `/api/shipments?id=${firstShipment}`, { carrier: 'Hijack' });
  check('another user cannot edit my shipment (404)', r.status === 404);
  r = await B.call('DELETE', `/api/orders?id=${orderId}`);
  check('another user cannot delete my order (404)', r.status === 404);

  // ---- validation
  r = await A.call('PUT', `/api/orders?id=${orderId}`, {});
  check('empty order update is rejected (400)', r.status === 400);
  r = await A.call('POST', '/api/shipments', { orderId, status: 'teleported' });
  check('invalid shipment status is rejected (400)', r.status === 400);

  // ---- pasted text import is consent-gated
  r = await A.call('POST', '/api/extract', { kind: 'order', text: 'Order GSH123 from SHEIN, total 88.31 ILS, shipped via HFD, tracking 96437781.' });
  check('pasted text import requires AI consent (403)', r.status === 403 && r.json?.error?.code === 'consent_required');

  // ---- cleanup
  r = await A.call('DELETE', `/api/orders?id=${orderId}`);
  check('delete order', r.status === 200);
  await A.call('DELETE', `/api/orders?id=${second}`);
} finally {
  await A.destroy();
  await B.destroy();
}
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
