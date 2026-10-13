// Real-browser PWA checks against a deployed URL (default: production).
// Usage: node tests/e2e/pwa.e2e.mjs [baseUrl]
import puppeteer from 'puppeteer-core';

const BASE = process.argv[2] ?? 'https://shupit.vercel.app';
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const results = [];
const check = (name, ok, extra = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox'],
  protocolTimeout: 60_000,
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const client = await page.createCDPSession();

  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60_000 });

  // --- manifest
  await client.send('Page.enable');
  const { url: manifestUrl, errors, data } = await client.send('Page.getAppManifest');
  check('manifest is served and parses without errors', !!manifestUrl && errors.length === 0, errors.map((e) => e.message).join('; '));
  const m = JSON.parse(data || '{}');
  check('manifest has name, start_url, standalone display', m.name === 'SHUPIT' && m.display === 'standalone' && !!m.start_url);
  const sizes = (m.icons ?? []).map((i) => `${i.sizes}:${i.purpose}`);
  check('icons include 192/512 any and maskable', ['192x192:any', '512x512:any', '192x192:maskable', '512x512:maskable'].every((s) => sizes.includes(s)), sizes.join(', '));
  check('share_target declared with POST and image file', m.share_target?.method === 'POST' && m.share_target?.params?.files?.[0]?.accept?.includes('image/*'));

  // --- every icon is reachable and an image
  let iconsOk = true;
  for (const i of m.icons ?? []) {
    const r = await fetch(new URL(i.src, BASE));
    if (!r.ok || !(r.headers.get('content-type') ?? '').startsWith('image/')) iconsOk = false;
  }
  check('all manifest icons load as images', iconsOk);

  // --- installability
  const { installabilityErrors } = await client.send('Page.getInstallabilityErrors');
  check('Chrome reports no installability errors', installabilityErrors.length === 0, installabilityErrors.map((e) => e.errorId).join(', '));

  // --- service worker
  const swState = await page.evaluate(async () => {
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((r) => setTimeout(() => r(null), 15000)),
    ]);
    return reg ? { scope: reg.scope, active: reg.active?.state } : { scope: null, active: 'none' };
  });
  check('service worker is active with root scope', swState.active === 'activated' && swState.scope === BASE.replace(/\/?$/, '/'), JSON.stringify(swState));

  // reload so the page is controlled and assets get cached
  await page.reload({ waitUntil: 'networkidle2' });
  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  check('page is controlled by the service worker after reload', controlled);

  // --- API requests are never cached
  const apiCached = await page.evaluate(async () => {
    for (const name of await caches.keys()) {
      const c = await caches.open(name);
      for (const req of await c.keys()) if (new URL(req.url).pathname.startsWith('/api/')) return true;
    }
    return false;
  });
  check('no /api responses are stored in caches', !apiCached);

  // --- offline fallback
  await page.setOfflineMode(true);
  let offlineOk = false;
  try {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 20_000 });
    const html = await page.content();
    offlineOk = /id="root"|SHUPIT/.test(html);
  } catch {
    offlineOk = false;
  }
  check('app shell loads while offline', offlineOk);
  const offlinePage = await page.evaluate(async () => {
    const r = await fetch('/offline.html').catch(() => null);
    return !!r && r.ok;
  });
  check('offline fallback page is available offline', offlinePage);
  await page.setOfflineMode(false);

  // --- share target (POST handled by the service worker)
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  const share = await page.evaluate(async () => {
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
    const fd = new FormData();
    fd.set('title', 'Nice shoes');
    fd.set('text', 'Check this https://www.nike.com/t/air-force-1');
    fd.set('url', 'https://www.nike.com/t/air-force-1');
    fd.set('image', new File([png], 'shot.png', { type: 'image/png' }));
    const res = await fetch('/share', { method: 'POST', body: fd, redirect: 'manual' });
    const cache = await caches.open('shupit-share-v1');
    const meta = await cache.match('/__shared/meta');
    const img = await cache.match('/__shared/image');
    return {
      redirected: res.type === 'opaqueredirect' || res.status === 303 || res.redirected,
      meta: meta ? await meta.json() : null,
      imageType: img ? img.headers.get('content-type') : null,
    };
  });
  check('share target stores shared text/url and image, then redirects', share.redirected && share.meta?.url?.includes('nike.com') && share.meta?.hasImage === true && share.imageType === 'image/png', JSON.stringify(share));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
