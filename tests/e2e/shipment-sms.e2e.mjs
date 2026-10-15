// Live check: update a shipment's status and add a shipment from a pasted carrier SMS. Spends ~2 AI calls.
// Usage: FIREBASE_WEB_API_KEY=... node tests/e2e/shipment-sms.e2e.mjs [baseUrl]
const BASE = process.argv[2] ?? 'https://app.shupit.co.il';
const KEY = process.env.FIREBASE_WEB_API_KEY;
if (!KEY) { console.error('FIREBASE_WEB_API_KEY is required'); process.exit(2); }
const idt = (p, b) => fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${p}?key=${KEY}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
const su = await idt('signUp', { email: `shupit-sms2-${Date.now()}@example.com`, password: 'Sm-' + Math.random().toString(36).slice(2) + 'Aa1!', returnSecureToken: true });
const H = { authorization: `Bearer ${su.idToken}`, 'content-type': 'application/json' };
const call = async (method, path, body) => { const r = await fetch(BASE + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => null) }; };
let ok = true;
const check = (n, c, x = '') => { if (!c) ok = false; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`); };
const fsShipments = () => fetch(`https://firestore.googleapis.com/v1/projects/shupit-8a4f5/databases/(default)/documents/users/${su.localId}/shipments`, { headers: { authorization: `Bearer ${su.idToken}` } }).then((r) => r.json());
try {
  await call('POST', '/api/account/consent', { terms: true, aiProcessing: true });
  const order = await call('POST', '/api/orders', { merchantName: 'SHEIN', externalOrderId: 'SMS2-1', items: [{ title: 'Test item', quantity: 1 }], shipments: [{ carrier: 'HFD', trackingNumber: 'HFD0091122', status: 'in_transit' }] });
  check('order created', order.status === 201);
  const list = await call('GET', '/api/shipments-list');
  const sid = list.body?.shipments?.[0]?.id;

  const sms = 'HFD: חבילה HFD0091122 יצאה לחלוקה והיא צפויה להגיע אליך היום.';
  const upd = await call('POST', `/api/shipments-status?id=${sid}`, { kind: 'order', text: sms });
  check('status updated from a short pasted SMS', upd.status === 200 && upd.body?.status === 'out_for_delivery', JSON.stringify(upd.body));

  const sms2 = 'Israel Post: Your parcel RR778899IL is in transit and expected on 2026-11-02.';
  const ext = await call('POST', '/api/extract', { kind: 'order', text: sms2 + ' ' + 'Tracking updates will follow.' });
  const sh = (ext.body?.orders ?? [ext.body]).flatMap((o) => o?.data?.shipments ?? [])[0];
  check('shipment details extracted from carrier SMS', ext.status === 200 && /RR778899IL/.test(sh?.trackingNumber ?? ''), JSON.stringify(sh));
  const created = await call('POST', '/api/shipments', { orderId: order.body.id, carrier: sh?.carrier ?? undefined, trackingNumber: sh?.trackingNumber ?? undefined, status: sh?.status ?? undefined });
  check('second shipment created', created.status === 201);
  const fs = await fsShipments();
  check('order now has two shipments', (fs.documents ?? []).length === 2);
} finally {
  await call('POST', '/api/account/delete', {});
  await idt('delete', { idToken: su.idToken });
}
console.log(ok ? '\nall passed' : '\nfailures');
process.exit(ok ? 0 : 1);
