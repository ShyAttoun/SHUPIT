// Live check of coupon-code extraction from text and a link. Spends 2–3 AI calls.
// Usage: FIREBASE_WEB_API_KEY=... node tests/e2e/coupons.e2e.mjs [baseUrl] [pageUrl]
const BASE = process.argv[2] ?? 'https://shupit.vercel.app';
const PAGE = process.argv[3] ?? 'https://il.iherb.com/';
const KEY = process.env.FIREBASE_WEB_API_KEY;
if (!KEY) { console.error('FIREBASE_WEB_API_KEY is required'); process.exit(2); }
const idt = (p, b) => fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${p}?key=${KEY}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
const su = await idt('signUp', { email: `shupit-coupons-${Date.now()}@example.com`, password: 'Cp-' + Math.random().toString(36).slice(2) + 'Aa1!', returnSecureToken: true });
const api = async (path, body, method = 'POST') => {
  const r = await fetch(BASE + path, { method, headers: { authorization: `Bearer ${su.idToken}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  let b = null; try { b = await r.json(); } catch {}
  return { status: r.status, body: b };
};
let ok = true;
const check = (n, c, x = '') => { if (!c) ok = false; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`); };
try {
  await api('/api/account/consent', { aiProcessing: true, terms: true });

  const text = 'iHerb spring sale! Use code SPRING20 for 20% off orders over $60. New customers: WELCOME5 gives $5 off your first order. Offer ends 2026-11-30. Free shipping over $40.';
  const a = await api('/api/extract', { kind: 'coupons', text });
  const codes = (a.body?.coupons ?? []).map((c) => c.code);
  check('codes read from pasted text', a.status === 200 && codes.includes('SPRING20') && codes.includes('WELCOME5'), JSON.stringify(a.body?.coupons));
  check('no code that is not in the text', codes.every((c) => text.toUpperCase().includes(c)));
  check('store detected from the name', a.body?.merchantId === 'iherb', `merchantId=${a.body?.merchantId}`);

  const none = await api('/api/extract', { kind: 'coupons', text: 'Our store is open Sunday to Thursday from nine to six. Visit us for the best selection of vitamins and supplements.' });
  check('text without codes returns an empty list', none.status === 200 && (none.body?.coupons ?? []).length === 0, JSON.stringify(none.body));

  const link = await api('/api/extract', { kind: 'coupons', url: PAGE });
  console.log(`link ${PAGE}: status=${link.status} coupons=${JSON.stringify(link.body?.coupons ?? link.body?.error)}`);
  check('link mode answers without crashing (200 or a clean 422)', link.status === 200 || link.status === 422);
} finally {
  await api('/api/account/delete', {});
  await idt('delete', { idToken: su.idToken });
}
console.log(ok ? '\nall passed' : '\nfailures');
process.exit(ok ? 0 : 1);
