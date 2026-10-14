// End-to-end user journeys driven through the real web UI in Chrome (English UI, then a Hebrew/RTL check).
// Creates and deletes one throwaway account. Spends a few AI calls (screenshot + pasted text).
// Usage: FIREBASE_WEB_API_KEY=... node tests/e2e/journeys.mjs [baseUrl]
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const BASE = process.argv[2] ?? 'https://shupit.vercel.app';
const KEY = process.env.FIREBASE_WEB_API_KEY;
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!KEY) {
  console.error('FIREBASE_WEB_API_KEY is required');
  process.exit(2);
}

const results = [];
const step = async (name, fn) => {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  } catch (e) {
    results.push({ name, ok: false });
    console.log(`FAIL  ${name}  — ${String(e.message ?? e).split('\n')[0]}`);
    await shot(`fail-${results.length}`);
  }
};

const idt = (p, b) =>
  fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${p}?key=${KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(b),
  }).then((r) => r.json());

const email = `shupit-journey-${Date.now()}@example.com`;
const password = 'Jy-' + Math.random().toString(36).slice(2) + 'Aa1!';

const downloads = mkdtempSync(join(tmpdir(), 'shupit-dl-'));
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--lang=en-US'],
  protocolTimeout: 120_000,
});
const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
await page.setViewport({ width: 420, height: 900, isMobile: true, hasTouch: true });
await page.setExtraHTTPHeaders({ 'accept-language': 'en-US,en;q=0.9' });
await page.evaluateOnNewDocument(() => {
  try {
    // Record window.open instead of spawning tabs (a background tab throttles the page under test).
    window.__opened = [];
    window.open = (u) => {
      window.__opened.push(String(u));
      return null;
    };
    if (!localStorage.getItem('shupit.language')) {
      localStorage.setItem('shupit.language', JSON.stringify({ state: { preference: 'en' }, version: 0 }));
    }
  } catch {}
});
const browserCdp = await browser.target().createCDPSession();
await browserCdp.send('Browser.setDownloadBehavior', {
  behavior: 'allow',
  downloadPath: downloads,
  browserContextId: ctx.id,
});
page.on('dialog', (d) => void d.accept());

async function shot(name) {
  try {
    await page.screenshot({ path: `tests/e2e/out/journey-${name}.png` });
  } catch {}
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = () => page.evaluate(() => document.body.innerText);
const waitText = (t, timeout = 30_000) =>
  page.waitForFunction((s) => document.body.innerText.includes(s), { timeout }, t);
const waitGone = (t, timeout = 30_000) =>
  page.waitForFunction((s) => !document.body.innerText.includes(s), { timeout }, t);
const esc = (s) => s.replace(/"/g, '\\"');
async function visible(handles) {
  const out = [];
  for (const h of handles) {
    const ok = await h.evaluate((e) => {
      const r = e.getBoundingClientRect();
      const st = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none' && !e.closest('[aria-hidden="true"]');
    });
    if (ok) out.push(h);
  }
  return out;
}

async function clickBtn(label, { nth = 0, timeout = 20_000 } = {}) {
  const xp = `xpath/.//*[(@role="button" or self::button or @role="link" or @role="checkbox" or @role="radio")][normalize-space(.)="${esc(label)}" or @aria-label="${esc(label)}" or starts-with(normalize-space(.), "${esc(label)}")]`;
  await page.waitForFunction(() => true);
  const deadline = Date.now() + timeout;
  let els = [];
  while (Date.now() < deadline) {
    els = await visible(await page.$$(xp));
    if (els[nth]) break;
    await sleep(250);
  }
  if (!els[nth]) throw new Error(`button not found: ${label}`);
  // Centre it first so sticky bars/headers never sit on top of the target.
  await els[nth].evaluate((e) => e.scrollIntoView({ block: 'center', inline: 'center' }));
  await sleep(150);
  try {
    await els[nth].click();
  } catch {
    await els[nth].evaluate((e) => e.click());
  }
}
async function fill(label, value) {
  const sel = `input[aria-label="${esc(label)}"], textarea[aria-label="${esc(label)}"]`;
  const deadline = Date.now() + 15_000;
  let el = null;
  while (Date.now() < deadline && !el) {
    el = (await visible(await page.$$(sel)))[0] ?? null;
    if (!el) await sleep(250);
  }
  if (!el) throw new Error(`field not found: ${label}`);
  await el.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await el.type(value);
}
async function clickInput(label) {
  const sel = `input[aria-label="${esc(label)}"]`;
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const el = (await visible(await page.$$(sel)))[0];
    if (el) {
      await el.evaluate((e) => e.scrollIntoView({ block: 'center' }));
      await el.click();
      return;
    }
    await sleep(250);
  }
  throw new Error(`input not found: ${label}`);
}

async function go(path) {
  await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 60_000 });
  await sleep(600);
}
const idToken = async () => (await idt('signInWithPassword', { email, password, returnSecureToken: true })).idToken;
const api = async (method, path, body) => {
  const r = await fetch(BASE + path, {
    method,
    headers: { authorization: `Bearer ${await idToken()}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => null) };
};

const ORDER_TEXT = `Thank you for your order!
Store: NORDIC HOME
Order number: JRN-4471
Order date: 2026-10-10
Items:
1 x Aurora Desk Lamp, Matte Black
2 x Linen Cushion Cover
Order total: 214.50 ILS
Shipping: HFD, tracking number HFD0091122, estimated delivery 2026-10-20`;

let productId = null;

try {
  // 1 ───────── registration
  await step('1  Register a new account and land on store selection', async () => {
    await go('/');
    await waitText('Welcome back');
    await clickBtn('Create account'); // switches the form to sign-up
    await waitText('Create your account');
    await fill('Email', email);
    await fill('Password', password);
    // The terms agreement switch is required.
    await clickInput('I agree to the');
    await clickBtn('Create account');
    await waitText('Where do you love to shop?', 40_000);
  });

  // 2 ───────── favorite stores
  await step('2  Pick favorite stores and open one', async () => {
    await clickBtn('Nike');
    await clickBtn('KSP');
    await waitText('2 stores selected');
    await clickBtn('Save my stores');
    await waitText('Add more stores');
    const t = await text();
    if (!t.includes('Nike') || !t.includes('KSP')) throw new Error('favorites not listed');
    await clickBtn('Shop now', { nth: 0 });
    await page.waitForFunction(() => window.__opened.length > 0, { timeout: 15_000 });
    const opened = await page.evaluate(() => window.__opened);
    if (!/nike\.com|ksp\.co\.il/.test(opened[0])) throw new Error(`unexpected destination: ${opened[0]}`);
  });

  // 3 ───────── save + edit product from a link
  await step('3  Save a product from a link, then edit it', async () => {
    await go('/product/add');
    await fill('Paste a product link', 'https://www.apple.com/shop/buy-iphone/iphone-16');
    await clickBtn('Get details');
    await waitText('Check the details', 45_000);
    await clickBtn('Save to wishlist');
    await waitText('Buy at store', 30_000);
    productId = page.url().split('/product/')[1];
    await clickBtn('Edit');
    await waitText('Edit product');
    await fill('Product name', 'My iPhone pick');
    await clickBtn('Save');
    await waitText('My iPhone pick');
  });

  // 4 ───────── screenshot extraction (AI, with consent)
  await step('4  Extract a product from a screenshot (consent → read → confirm)', async () => {
    await go('/product/add');
    const input = await page.$('input[type=file]');
    await input.uploadFile('tests/e2e/fixtures/product-shot.png');
    await waitText('Let SHUPIT read your screenshots?', 20_000);
    await clickBtn('I agree');
    await waitText('Aurora', 60_000);
    const t = await text();
    if (!/89\.9/.test(t)) throw new Error('price not read from the screenshot');
  });

  // 5 ───────── create + edit an order from pasted text
  await step('5  Create an order from pasted text and edit it', async () => {
    await go('/order/add');
    await clickBtn('Paste order text');
    await fill('Paste order text', ORDER_TEXT);
    await clickBtn('Read the text');
    await waitText('check everything before saving', 60_000);
    await clickBtn('Save order');
    await waitText('JRN-4471', 30_000);
    await clickBtn('Edit order');
    await waitText('Edit order');
    await fill('Order number (Optional)', 'JRN-4472');
    await clickBtn('Save changes');
    await waitText('JRN-4472');
  });

  // 6 ───────── multiple shipments
  await step('6  Add a second shipment to the order', async () => {
    await clickBtn('Add a shipment');
    await waitText('Add a shipment');
    await fill('Carrier (Optional)', 'Israel Post');
    await fill('Tracking number (Optional)', 'RR778899IL');
    await clickBtn('Save shipment');
    await waitText('RR778899IL', 30_000);
    const t = await text();
    if (!t.includes('HFD0091122')) throw new Error('first shipment missing');
  });

  // 7 ───────── update tracking status
  await step('7  Set a shipment status manually (shown as set by you)', async () => {
    await clickBtn('Edit shipment', { nth: 1 });
    await waitText('Edit shipment');
    await clickBtn('Ready for pickup');
    await clickBtn('Save shipment');
    await waitText('Set by you', 30_000);
    const t = await text();
    if (!t.includes('Ready for pickup')) throw new Error('status not shown');
  });

  // 8 ───────── duplicate import
  await step('8  Importing the same order again is flagged as a duplicate', async () => {
    await go('/order/add');
    await clickBtn('Paste order text');
    await fill('Paste order text', ORDER_TEXT.replace('JRN-4471', 'JRN-4472'));
    await clickBtn('Read the text');
    await waitText('check everything before saving', 60_000);
    await clickBtn('Save order');
    await waitText('You already added this order.', 30_000);
  });

  // 9 ───────── verified price drop (extension step is simulated through its API)
  await step('9  A verified price drop creates an alert for a tracked product', async () => {
    await go(`/product/${productId}`);
    await waitText('Track price');
    // enable tracking through the real switch (wait until it is interactive, then until it is on)
    await page.waitForFunction(
      () => {
        const i = document.querySelector('input[aria-label="Track price"]');
        return !!i && !i.disabled;
      },
      { timeout: 20_000 },
    );
    await clickInput('Track price');
    await page.waitForFunction(
      () => document.querySelector('input[aria-label="Track price"]')?.checked === true,
      { timeout: 15_000 },
    );
    await sleep(1500);
    const doc = await api('GET', '/api/account/export');
    const prod = doc.json?.userData?.collections?.savedProducts?.find((p) => p.id === productId)?.data;
    if (!prod?.productUrl) throw new Error('saved product has no url');
    const base = { pageUrl: prod.productUrl, pageTitle: prod.title };
    let r = await api('POST', '/api/price-observations', { ...base, price: { amountMinor: 399900, currency: 'ILS' }, confirmed: true });
    if (r.status !== 200) throw new Error(`first observation ${r.status}`);
    r = await api('POST', '/api/price-observations', { ...base, price: { amountMinor: 349900, currency: 'ILS' }, confirmed: true });
    if (r.status !== 200 || r.json?.alerts?.[0]?.result !== 'created') throw new Error(`no alert: ${JSON.stringify(r.json)}`);
  });

  // 10 ──────── notification in the app
  await step('10 The alert appears as unread, opens the product and is marked read', async () => {
    await go('/');
    await page.waitForSelector('[aria-label^="Notifications ("]', { timeout: 20_000 });
    await clickBtn('Notifications (1)');
    await waitText('price dropped');
    await waitText('New');
    await clickBtn('price dropped', { nth: 0 });
    await waitText('Buy at store', 20_000);
    await go('/notifications');
    await waitGone('New', 10_000).catch(() => {
      throw new Error('notification still unread');
    });
  });

  // 11 ──────── export
  await step('11 Export my data downloads a valid JSON file', async () => {
    await go('/settings');
    await clickBtn('Export my data');
    let file = null;
    for (let i = 0; i < 30 && !file; i++) {
      await sleep(500);
      file = readdirSync(downloads).find((f) => f.endsWith('.json'));
    }
    if (!file) throw new Error('no downloaded file');
    const data = JSON.parse(readFileSync(join(downloads, file), 'utf8'));
    if (data.formatVersion !== 1 || !data.userData?.collections?.orders?.length) throw new Error('export incomplete');
  });

  // 12 ──────── RTL spot-check, then delete the account
  await step('12 Hebrew/RTL renders, then the account can be deleted', async () => {
    await page.evaluate(() => {
      localStorage.setItem('shupit.language', JSON.stringify({ state: { preference: 'he' }, version: 0 }));
    });
    await go('/settings');
    const dir = await page.evaluate(() => document.documentElement.dir);
    if (dir !== 'rtl') throw new Error(`dir=${dir}`);
    await shot('rtl-settings');
    // back to English for stable labels, then delete
    await page.evaluate(() => {
      localStorage.setItem('shupit.language', JSON.stringify({ state: { preference: 'en' }, version: 0 }));
    });
    await go('/settings');
    await clickBtn('Delete my account');
    await waitText('Delete your account?');
    await clickInput('I understand this is permanent');
    await fill('Password', password);
    await clickBtn('Permanently delete my account');
    await waitText('Welcome back', 60_000);
    const login = await idt('signInWithPassword', { email, password, returnSecureToken: true });
    if (!login.error) throw new Error('account still exists');
  });
} finally {
  await browser.close();
  // Safety net if the delete journey did not complete.
  const login = await idt('signInWithPassword', { email, password, returnSecureToken: true }).catch(() => null);
  if (login?.idToken) {
    await fetch(BASE + '/api/account/delete', { method: 'POST', headers: { authorization: `Bearer ${login.idToken}` } }).catch(() => undefined);
    console.log('(cleanup) account removed by safety net');
  }
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} journeys passed`);
process.exit(failed ? 1 : 0);
