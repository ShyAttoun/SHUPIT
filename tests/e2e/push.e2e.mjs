// Real-browser Web Push check: subscribe → server sends on a price drop → service worker shows it.
// Usage: FIREBASE_WEB_API_KEY=... VAPID_PUBLIC_KEY=... node tests/e2e/push.e2e.mjs [baseUrl]
import puppeteer from 'puppeteer-core';

const BASE = process.argv[2] ?? 'https://shupit.vercel.app';
const KEY = process.env.FIREBASE_WEB_API_KEY;
const VAPID = process.env.VAPID_PUBLIC_KEY;
const PROJECT = process.env.FIREBASE_PROJECT_ID ?? 'shupit-8a4f5';
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!KEY || !VAPID) {
  console.error('FIREBASE_WEB_API_KEY and VAPID_PUBLIC_KEY are required');
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
  email: `shupit-push-${Date.now()}@example.com`,
  password: 'Pu-' + Math.random().toString(36).slice(2) + 'Aa1!',
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
const fsPatch = (path, fields) =>
  fetch(`${FS}/${path}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ fields }),
  });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], protocolTimeout: 90_000 });
try {
  const ctx = browser.defaultBrowserContext();
  await ctx.overridePermissions(BASE, ['notifications']);
  const page = await browser.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60_000 });

  const sub = await page.evaluate(async (vapid) => {
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 20000))]);
    if (!reg) return { error: 'no service worker' };
    const pad = '='.repeat((4 - (vapid.length % 4)) % 4);
    const raw = atob((vapid + pad).replace(/-/g, '+').replace(/_/g, '/'));
    const key = Uint8Array.from(raw, (c) => c.charCodeAt(0));
    try {
      const s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      return { json: s.toJSON() };
    } catch (e) {
      return { error: String(e) };
    }
  }, VAPID);
  check('browser subscribed to push', !!sub.json?.endpoint, sub.error ?? '');
  if (!sub.json) throw new Error('cannot continue without a subscription');

  let r = await api('POST', '/api/account/push', { subscription: sub.json, lang: 'en' });
  check('device registered on the server', r.status === 200);
  r = await api('GET', '/api/account/push');
  check('server reports push configured and 1 device', r.json?.configured === true && r.json?.devices === 1);

  await fsPatch(`users/${uid}/preferences/notifications`, { push: { booleanValue: true } });
  const URL1 = 'https://www.nike.com/t/push-test-shoe';
  r = await api('POST', '/api/products', { title: 'Push Test Shoe', productUrl: URL1, price: { amountMinor: 50000, currency: 'ILS' } });
  const pid = r.json?.id;
  await fsPatch(`priceWatchSubscriptions/${uid}_${pid}`, {
    id: { stringValue: `${uid}_${pid}` },
    uid: { stringValue: uid },
    savedProductId: { stringValue: pid },
    enabled: { booleanValue: true },
    minDropPercent: { integerValue: '5' },
  });
  await api('POST', '/api/price-observations', { pageUrl: URL1, price: { amountMinor: 50000, currency: 'ILS' } });
  r = await api('POST', '/api/price-observations', { pageUrl: URL1, price: { amountMinor: 40000, currency: 'ILS' } });
  check('price drop alert created (push is sent with it)', r.status === 200 && r.json?.alerts?.[0]?.result === 'created');

  // The service worker should have shown the notification.
  let shown = [];
  for (let i = 0; i < 20 && shown.length === 0; i++) {
    await new Promise((res) => setTimeout(res, 1000));
    shown = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return (await reg.getNotifications()).map((n) => ({ title: n.title, body: n.body, url: n.data?.url }));
    });
  }
  check('service worker displayed the push notification', shown.length === 1 && shown[0].title === 'Price drop', JSON.stringify(shown));
  check('notification deep-links to the product', typeof shown[0]?.url === 'string' && shown[0].url.startsWith('/product/'));

  r = await api('DELETE', '/api/account/push');
  r = await api('GET', '/api/account/push');
  check('device can be unregistered', r.json?.devices === 0);
} catch (e) {
  check('push journey completed', false, String(e));
} finally {
  await browser.close();
  await api('POST', '/api/account/delete').catch(() => undefined);
}
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
