# SHUPIT beta readiness checklist

Last verified: 2026-10-14 against production (`https://shupit.vercel.app`). ✅ done & verified · 🟡 partial · ⛔ blocked on an external item.

## Test evidence
| Suite | Where | Result |
|---|---|---|
| API unit tests | `npm run test:api` | 70/70 |
| Contracts unit tests | `packages/contracts` | 11/11 |
| App unit tests | `apps/app` (jest) | 40/40 |
| Firestore emulator (export, deletion, consent, order edits, shipments, price watch, notifications) | `npm run test:emulator` | 22/22 |
| Firestore rules | `npm run test:rules` | 10/10 |
| PWA in real Chrome (manifest, installability, SW, offline, share target) | `tests/e2e/pwa.e2e.mjs` | 12/12 |
| Web Push in real Chrome (subscribe → server push → SW shows it) | `tests/e2e/push.e2e.mjs` | 7/7 |
| Live API journeys (orders, shipments, isolation) | `tests/e2e/api.e2e.mjs` | 15/15 |
| Live price/alerts/preferences journey | `tests/e2e/price.e2e.mjs` | 17/17 |
| **12 UI journeys through the real web UI** | `tests/e2e/journeys.mjs` | **12/12** |
| axe accessibility + overflow + RTL, 4 viewports × 9 screens (+ Hebrew) | `tests/e2e/audit.mjs` | 0 critical/serious · 1 moderate · 0 overflow · all RTL |

The 12 journeys: registration → favorite stores (+ opens store) → save & edit product → screenshot extraction (with AI consent) →
create & edit order from pasted text → add shipments → set status → duplicate import refused → verified price drop alert →
notification unread/open/read → data export → Hebrew/RTL check and account deletion.

## Phase 1 — privacy, security, account
- ✅ Account deletion (re-auth ≤5 min, recursive delete, anonymized click log, Auth user removed, idempotent) — emulator + live
- ✅ Data export (all nesting levels, push keys excluded) — emulator + live + UI
- ✅ Privacy / Terms / Affiliate pages, linked from sign-in, sign-up (agreement required) and settings
- 🟡 Legal texts are **drafts**: operator name/address, contact email and governing law are placeholders; not lawyer-reviewed
- ✅ AI processing disclosure + explicit consent, enforced server-side (`403 consent_required`), revocable
- ✅ Retention cron (`/api/cron/cleanup`, daily): click log 90d, usage 35d, read notifications 180d, error reports 30d, rate-limit counters
- ✅ Rate limiting per user and bucket (default 120/min, AI 20/min + 30/day + global daily cap, export/delete 5/h), fail-open
- ✅ Authorization: every user endpoint wrapped in `withAuth` (static test), uid only from the verified token, cross-user isolation tested live

## Phase 2 — PWA & sharing
- ✅ Manifest, any/maskable/apple icons, favicon set (brand-supplied), offline page, versioned service worker
- ✅ Chrome installability (no errors), offline shell, no `/api` caching
- ✅ Web Share Target (text, URL, image) → `/share` → wishlist or order flows; survives sign-in
- 🟡 **Not tested on real devices**: Android Chrome, iOS Safari. iOS has no share target (documented, paste fallback); iOS push needs the installed PWA
- ✅ Install prompt (Chrome) and iOS instructions in Settings

## Phase 3 — core workflows
- ✅ Edit product (hand-edited price is no longer shown as store-verified; provenance kept)
- ✅ Edit order (only changed fields get user provenance; duplicate re-check)
- ✅ Add / edit / remove shipments (history preserved; user-set status labelled as set by you)
- ✅ Pickup address, deadline, instructions, collection code (read from pages/screenshots or entered)
- ✅ Paste order text import; screenshot and link import; duplicate detection
- 🟡 Collections: add/remove membership and rename/delete work; there is no drag-to-reorder

## Phase 4 — price watch & notifications
- ✅ Manual price verification via the extension ("Verify price"): identity + variant checks, verified-only baselines, never described as automatic
- ✅ Alerts: price drop, target reached; threshold, dedupe, per-type preferences
- ✅ Shipment status / ready for pickup / exception notifications from manual and carrier updates through one engine
- ✅ Unread/read states, notification list, bell badge, preferences
- ✅ Browser push (Web Push, VAPID): opt-in, only after permission, verified in real Chrome
- ⛔ **Automatic** price monitoring: needs an authorized price source (affiliate feed/API) per merchant — none connected, UI says so
- ⛔ **Automatic** carrier tracking: adapter exists (Ship24) but its response shape is unverified and no API key is set
- 🟡 Push on Android/iOS devices not tested

## Phase 5 — reliability
- ✅ Structured JSON logs with redaction (emails, tokens, JWTs, URL queries, secrets), hashed user ids
- ✅ Client error reporting (redacted, 30-day retention) + error boundary with recovery screen
- ✅ Per-account content caps (500 orders, 1000 saved products) and a global AI daily budget guard (kill-switch, 80% warning log)
- ✅ Extension permission review (`docs/EXTENSION-SECURITY.md`); production build has no localhost origin
- 🟡 Accessibility: 1 moderate axe finding left (4 tab-bar labels and a header wrapper outside landmarks; Expo Router's tab bar can't be given a landmark without a custom tab bar)
- 🟡 Responsive: verified at 360/390/768/1280 widths in Chrome emulation, not on physical phones
- ⛔ **Third-party error monitoring** (Sentry etc.): needs an account/DSN; errors currently go to our own redacted store + Vercel logs
- ⛔ **Budget alerts**: Firebase is on Spark (no billing → no budget API). Set an Anthropic monthly spend limit and a Vercel spend cap in their consoles
  (AI is also bounded in code: 30/user/day, 300/day global via `AI_DAILY_GLOBAL_LIMIT`)

## Open items that need you
1. Complete legal placeholders (operator, contact email, governing law) and have them reviewed.
2. Anthropic console: set a monthly spend limit. Vercel: set a spend cap.
3. Vercel → Settings → Environments → Production → branch tracking `main` (pushes currently create previews; production is deployed from the CLI).
4. Decide on Chrome Web Store publication (developer account, listing, privacy URL).
5. Real-device pass: Android Chrome + iOS Safari (install, share, push).
6. Decide whether to connect a tracking provider / price sources, or keep manual verification.
7. Add a Content-Security-Policy (currently nosniff, frame-deny, referrer policy only).
8. Visual redesign from the approved mockups (deliberately not started).

## Addendum: RTL, brand grouping, pickup distance, Home carousel and coupons
- Hebrew UI text is right-aligned/RTL everywhere (theme `isRTL`/`endAlign`; `Text`, `TextField`, `SearchField`). Audit: all pages `dir=rtl`, no overflow.
- Wishlist is grouped by brand, split by site inside a brand, each item has a "Take me to the store" CTA.
- Orders list shows pickup point + address; "distance from you" appears only after the user taps "Show distance from me" (browser geolocation, computed on device, never sent). Address → coordinates via server-side geocoding (Nominatim), cached in `geocodeCache` (180 days).
- Home: auto-advancing wishlist carousel (pauses on hover/touch, off with reduced motion) and a coupons rubric for favorite stores.
  - **Coupons have no automatic feed.** They are codes the user saves (`users/{uid}/coupons`) plus an empty, server-managed `partnerCoupons` collection.
- Evidence: api unit 72/72, emulator 26/26, rules 13/13, app jest 49/49, UI journeys 12/12 (local build against production API), axe 0 critical/serious.
- Not yet verified: real-device geolocation prompt, Nominatim live lookup (needs the deployed `/api/geocode`).

## Addendum: UI/UX 2.0 (first increments)
- Design foundation: breakpoints, elevation, gradients, easing tokens; one nav component (bottom bar on phones/tablets, side rail from 1024px, on the start edge); responsive `Grid`; bounded `Section` panels.
- Home: hero with data-backed summary, verified price drops (only user-verified prices, same currency), liked carousel, coupons, stage-based shipment progress (stage only, never an invented percentage/position).
- Orders, Stores, Wishlist: responsive grids; Orders/Detail show shipment stage progress.
- Also added: Toast, BottomSheet (coupon form), reduced-motion-aware skeletons, featured favorites row on Stores, Home sections in a responsive grid.
- Not done: store categories/filters (the merchant catalog has no category data), page transitions, desktop side panels, price-history chart rework, screenshot review with real data per breakpoint.
