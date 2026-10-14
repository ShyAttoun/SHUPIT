// Live check of the phone-automation path: key → SMS → pickup applied to the right shipment.
// Spends 1 AI call. Usage: FIREBASE_WEB_API_KEY=... node tests/e2e/sms-hook.e2e.mjs [baseUrl]
const BASE = process.argv[2] ?? 'https://shupit.vercel.app';
const KEY = process.env.FIREBASE_WEB_API_KEY;
if (!KEY) { console.error('FIREBASE_WEB_API_KEY is required'); process.exit(2); }
const idt = (p, b) => fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${p}?key=${KEY}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
const email = `shupit-sms-${Date.now()}@example.com`;
const su = await idt('signUp', { email, password: 'Sm-' + Math.random().toString(36).slice(2) + 'Aa1!', returnSecureToken: true });
const auth = { authorization: `Bearer ${su.idToken}`, 'content-type': 'application/json' };
const api = async (path, init = {}) => {
  const r = await fetch(BASE + path, { ...init, headers: { ...auth, ...(init.headers ?? {}) } });
  let b = null; try { b = await r.json(); } catch {}
  return { status: r.status, body: b };
};
let ok = true;
const check = (n, c, x = '') => { if (!c) ok = false; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`); };
try {
  await api('/api/account/consent', { method: 'POST', body: JSON.stringify({ aiProcessing: true, terms: true }) });
  const order = await api('/api/orders', { method: 'POST', body: JSON.stringify({
    merchantName: 'SHEIN', externalOrderId: 'SMS-TEST-1', items: [{ title: 'Test item', quantity: 1 }],
    shipments: [{ carrier: 'HFD', trackingNumber: 'HFD0091122', status: 'in_transit' }] }) });
  check('order with one open shipment created', order.status === 201, `status=${order.status}`);

  const noKey = await fetch(BASE + '/api/sms-hook', { method: 'POST', body: JSON.stringify({ text: 'hello world hello' }) });
  check('hook rejects a request without a key', noKey.status === 401, `status=${noKey.status}`);

  const created = await api('/api/automation-key', { method: 'POST' });
  const key = created.body?.key;
  check('automation key created (shown once)', created.status === 201 && /^shp_/.test(key ?? ''));
  const status = await api('/api/automation-key');
  check('status reports the key without exposing it', status.body?.exists === true && !JSON.stringify(status.body).includes(key));

  const sms = 'SHEIN: החבילה שלך HFD0091122 הגיעה לנקודת איסוף "קיוסק הרצל", הרצל 12, תל אביב. ניתן לאסוף עד 25/10. קוד איסוף: 4821.';
  const r = await fetch(BASE + '/api/sms-hook', { method: 'POST', headers: { 'x-shupit-key': key, 'content-type': 'application/json' }, body: JSON.stringify({ text: sms }) });
  const body = await r.json().catch(() => null);
  check('SMS applied to the shipment', r.status === 200 && body?.applied === true, JSON.stringify(body));

  const fs = await fetch(
    `https://firestore.googleapis.com/v1/projects/shupit-8a4f5/databases/(default)/documents/users/${su.localId}/shipments`,
    { headers: { authorization: `Bearer ${su.idToken}` } },
  ).then((r) => r.json());
  const f = fs.documents?.[0]?.fields?.pickup?.mapValue?.fields ?? {};
  const val = (k) => f[k]?.stringValue ?? null;
  console.log('shipment pickup:', JSON.stringify({ name: val('name'), address: val('address'), until: val('until'), code: val('code') }));
  check('pickup address stored on the shipment', !!val('address'));
  check('status was not changed by the hook', fs.documents?.[0]?.fields?.status?.stringValue === 'in_transit');

  const bad = await fetch(BASE + '/api/sms-hook', { method: 'POST', headers: { 'x-shupit-key': 'shp_' + 'x'.repeat(43), 'content-type': 'application/json' }, body: JSON.stringify({ text: sms }) });
  check('a wrong key is rejected', bad.status === 401, `status=${bad.status}`);

  await api('/api/automation-key', { method: 'DELETE' });
  const revoked = await fetch(BASE + '/api/sms-hook', { method: 'POST', headers: { 'x-shupit-key': key, 'content-type': 'application/json' }, body: JSON.stringify({ text: sms }) });
  check('a revoked key stops working', revoked.status === 401, `status=${revoked.status}`);
} finally {
  await api('/api/account/delete', { method: 'POST', body: JSON.stringify({}) });
  await idt('delete', { idToken: su.idToken });
}
console.log(ok ? '\nall passed' : '\nfailures');
process.exit(ok ? 0 : 1);
