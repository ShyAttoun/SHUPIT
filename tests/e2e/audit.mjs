// Accessibility (axe), responsive-overflow and RTL audit of the deployed web app, in a real browser.
// Usage: FIREBASE_WEB_API_KEY=... node tests/e2e/audit.mjs [baseUrl] [outDir]
import { readFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer-core';

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const BASE = process.argv[2] ?? 'https://shupit.vercel.app';
const OUT = process.argv[3] ?? `tests/e2e/out`;
const KEY = process.env.FIREBASE_WEB_API_KEY;
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
mkdirSync(OUT, { recursive: true });

const THEME = process.env.THEME ?? 'system';
const ROUTES = ['/', '/stores', '/wishlist', '/orders', '/notifications', '/settings', '/order/add', '/product/add', '/legal/privacy'];
const VIEWPORTS = [
  { name: 'phone-small', width: 360, height: 640, isMobile: true, hasTouch: true },
  { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: 'tablet', width: 768, height: 1024, isMobile: true, hasTouch: true },
  { name: 'desktop', width: 1280, height: 800, isMobile: false, hasTouch: false },
];

const idt = (p, b) =>
  fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${p}?key=${KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(b),
  }).then((r) => r.json());

const email = `shupit-audit-${Date.now()}@example.com`;
const password = 'Au-' + Math.random().toString(36).slice(2) + 'Aa1!';
const su = await idt('signUp', { email, password, returnSecureToken: true });

const findings = { axe: new Map(), overflow: [], rtl: [] };
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], protocolTimeout: 90_000 });

async function signIn(page) {
  await page.evaluateOnNewDocument((theme) => {
    try {
      if (theme !== 'system') localStorage.setItem('shupit.theme', JSON.stringify({ state: { preference: theme }, version: 0 }));
    } catch {}
  }, THEME);
  await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 60_000 });
  await page.waitForSelector('input[aria-label="Email"], input[aria-label="אימייל"]', { timeout: 20_000 });
  await page.type('input[aria-label="Email"], input[aria-label="אימייל"]', email);
  await page.type('input[aria-label="Password"], input[aria-label="סיסמה"]', password);
  const [btn] = await page.$$('xpath/.//*[@role="button"][.//text()[contains(.,"Sign in") or contains(.,"התחברות")]]');
  await btn.click();
  await page.waitForFunction(() => !document.querySelector('input[type="password"]'), { timeout: 30_000 });
  // Dismiss the first-run welcome tour (remembered per user afterwards).
  const skip = await page
    .waitForSelector('[aria-label="Skip"], [aria-label="דלג"]', { timeout: 8000 })
    .catch(() => null);
  if (skip) await skip.click();
}

async function audit(page, route, tag) {
  await page.goto(BASE + route, { waitUntil: 'networkidle2', timeout: 60_000 });
  await new Promise((r) => setTimeout(r, 900));
  await page.evaluate(AXE);
  const result = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, { resultTypes: ['violations'] });
    return r.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.length,
      sample: v.nodes[0]?.html.slice(0, 140),
    }));
  });
  for (const v of result) {
    const key = `${v.id}|${v.impact}`;
    const cur = findings.axe.get(key) ?? { ...v, pages: new Set(), nodes: 0 };
    cur.pages.add(`${tag}${route}`);
    cur.nodes += v.nodes;
    findings.axe.set(key, cur);
  }
  const overflow = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
    dir: document.documentElement.dir,
  }));
  return overflow;
}

try {
  // ---------- LTR, all viewports
  for (const vp of VIEWPORTS) {
    // Fresh context per run: signed-in state persists per browser profile.
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport(vp);
    await signIn(page);
    for (const route of ROUTES) {
      const o = await audit(page, route, `${vp.name}`);
      if (o.scrollW > o.innerW + 1) findings.overflow.push(`${vp.name} ${route}: ${o.scrollW} > ${o.innerW}`);
      if (vp.name === 'phone' || (vp.name === 'desktop' && ['/', '/stores'].includes(route))) {
        await page.screenshot({ path: `${OUT}/${vp.name}${route.replace(/\//g, '_') || '_home'}.png` });
      }
    }
    await ctx.close();
  }

  // ---------- RTL (Hebrew), phone + tablet
  for (const vp of [VIEWPORTS[1], VIEWPORTS[2]]) {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport(vp);
    await page.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem('shupit.language', JSON.stringify({ state: { preference: 'he' }, version: 0 }));
      } catch {}
    });
    await signIn(page);
    for (const route of ROUTES) {
      const o = await audit(page, route, `he-${vp.name}`);
      if (o.dir !== 'rtl') findings.rtl.push(`he-${vp.name} ${route}: dir=${o.dir}`);
      if (o.scrollW > o.innerW + 1) findings.overflow.push(`he-${vp.name} ${route}: ${o.scrollW} > ${o.innerW}`);
      if (vp.name === 'phone') await page.screenshot({ path: `${OUT}/he-${vp.name}${route.replace(/\//g, '_') || '_home'}.png` });
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  // clean up the throwaway account (data deleted by the server-side endpoint)
  const login = await idt('signInWithPassword', { email, password, returnSecureToken: true });
  if (login.idToken) {
    await fetch(BASE + '/api/account/delete', { method: 'POST', headers: { authorization: `Bearer ${login.idToken}` } }).catch(() => undefined);
  }
}

console.log('\n=== Accessibility violations (axe) ===');
const sorted = [...findings.axe.values()].sort((a, b) => ['critical', 'serious', 'moderate', 'minor'].indexOf(a.impact) - ['critical', 'serious', 'moderate', 'minor'].indexOf(b.impact));
for (const v of sorted) {
  console.log(`[${v.impact}] ${v.id} — ${v.help}\n   pages: ${[...v.pages].slice(0, 6).join(', ')}${v.pages.size > 6 ? ` (+${v.pages.size - 6})` : ''}\n   e.g. ${v.sample}`);
}
if (sorted.length === 0) console.log('none');
console.log('\n=== Horizontal overflow ===');
console.log(findings.overflow.length ? findings.overflow.join('\n') : 'none');
console.log('\n=== RTL direction ===');
console.log(findings.rtl.length ? findings.rtl.join('\n') : 'all pages dir=rtl');
const bad = sorted.filter((v) => v.impact === 'critical' || v.impact === 'serious').length + findings.overflow.length + findings.rtl.length;
process.exit(bad ? 1 : 0);
