// Back-button behaviour: a PWA opened straight on an inner screen must go Home on back, not close.
// Usage: FIREBASE_WEB_API_KEY=... node tests/e2e/back.e2e.mjs [baseUrl]
import puppeteer from 'puppeteer-core';

const BASE = process.argv[2] ?? 'https://shupit.vercel.app';
const KEY = process.env.FIREBASE_WEB_API_KEY;
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!KEY) {
  console.error('FIREBASE_WEB_API_KEY is required');
  process.exit(2);
}
const idt = (p, b) =>
  fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${p}?key=${KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(b),
  }).then((r) => r.json());

const email = `shupit-back-${Date.now()}@example.com`;
const password = 'Bk-' + Math.random().toString(36).slice(2) + 'Aa1!';
const su = await idt('signUp', { email, password, returnSecureToken: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const results = [];
const check = (name, ok, extra = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
};

try {
  const ctx = await browser.createBrowserContext();
  const first = await ctx.newPage();
  await first.setViewport({ width: 420, height: 900, isMobile: true });
  await first.goto(BASE + '/', { waitUntil: 'networkidle2' });
  const E = 'input[aria-label="Email"], input[aria-label="אימייל"]';
  await first.waitForSelector(E, { timeout: 20_000 });
  await first.type(E, email);
  await first.type('input[aria-label="Password"], input[aria-label="סיסמה"]', password);
  const [btn] = await first.$$('xpath/.//*[@role="button"][.//text()[contains(.,"Sign in") or contains(.,"התחברות")]]');
  await btn.click();
  await first.waitForFunction(() => !document.querySelector('input[type="password"]'), { timeout: 30_000 });
  const close = await first
    .waitForSelector('[aria-label="Close"], [aria-label="סגירה"]', { timeout: 10_000 })
    .catch(() => null);
  if (close) await close.click();

  // A fresh tab opened directly on an inner screen (like a push notification or share would).
  const page = await ctx.newPage();
  await page.setViewport({ width: 420, height: 900, isMobile: true });
  await page.goto(BASE + '/orders', { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => document.body.innerText.length > 50, { timeout: 20_000 });
  const len = await page.evaluate(() => window.history.length);
  check('inner screen opened directly has Home beneath it', len >= 2, `history.length=${len}`);
  await page.goBack();
  await new Promise((r) => setTimeout(r, 800));
  const path = await page.evaluate(() => window.location.pathname);
  const text = await page.evaluate(() => document.body.innerText);
  check('back from it lands on Home (app not closed)', path === '/' && /Home|Welcome back|בית|ברוך שובך/.test(text), `path=${path}`);
} finally {
  await browser.close();
  await idt('delete', { idToken: su.idToken });
}
const failed = results.filter((x) => !x).length;
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
