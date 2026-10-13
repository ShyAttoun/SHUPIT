# SHUPIT architecture decisions

## Stack
- **Client:** Expo + React Native Web + Expo Router (`apps/app`), web/PWA first.
- **Shared:** `@shupit/tokens` (design tokens), `@shupit/contracts` (Zod schemas, domain types).
- **Backend:** Vercel Functions in `api/` (Firebase Admin SDK) — replaces the Cloud Functions /
  Cloud Tasks / Cloud Scheduler trio from the original brief (decision: 2026-10-13, no Blaze plan needed).
- **Firebase (Spark):** Authentication, Cloud Firestore (`me-west1`), Cloud Messaging.
- **Extension:** separate Chrome MV3 project (Phase 4), sharing `@shupit/contracts`.

## Trust boundary
- Clients read their own data directly from Firestore under `firestore.rules`.
- Anything derived or sensitive (orders import, price observations, alerts, affiliate clicks,
  AI extraction) is written only by `api/` using the Admin SDK. Every endpoint is wrapped in
  `withAuth` (Firebase ID token verified server-side).
- Server-only collections have no client access: `canonicalProducts`, `productVariants`,
  `priceObservations`, `merchantPriceProviders`, `affiliatePrograms`, `affiliateClicks`.

## Price Watch job model (replaces Cloud Tasks)
- Jobs live in Firestore with a deterministic id (`variantId-<time bucket>`) → idempotent enqueue.
- A Vercel Cron dispatcher claims due jobs with a lease, processes a bounded batch, retries with
  capped backoff, and records provenance on every observation.
- Only `live`/`feed` observations may alert; alerts dedupe on `subscriptionId:observationId`.
- Prices are compared only within the same currency; FX is display-only.

## Secrets
- Public Firebase web config: `apps/app/.env` (EXPO_PUBLIC_*), not secret.
- Server secrets (service account, AI key, carrier API keys): Vercel project env only.

## Open items
- Hebrew copy is a draft pending review.
- App icon / favicon PNGs must be redrawn as vectors from the brand mark.
- Vercel project link, env vars and first deploy are pending user approval.
