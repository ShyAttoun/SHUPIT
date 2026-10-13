// Adds PWA tags to the exported index.html (Expo's Metro export has no manifest support).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const file = 'dist/index.html';
if (!existsSync(file)) {
  console.error('dist/index.html not found; run expo export first');
  process.exit(1);
}
let html = readFileSync(file, 'utf8');

const tags = `
    <meta name="description" content="Favorite stores, wishlist, orders and delivery tracking in one place." />
    <meta name="theme-color" content="#071625" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" type="image/png" sizes="64x64" href="/icons/favicon-64.png" />
    <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16.png" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="SHUPIT" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />`;

if (!html.includes('rel="manifest"')) {
  html = html.replace('</head>', `${tags}\n  </head>`);
}
// Viewport-fit=cover so installed iOS/Android PWAs use the full screen (safe areas handled in app).
html = html.replace(/(<meta name="viewport" content="[^"]*)"/, (m, a) =>
  a.includes('viewport-fit') ? m : `${a}, viewport-fit=cover"`,
);
writeFileSync(file, html);
console.log('PWA tags injected into dist/index.html');
