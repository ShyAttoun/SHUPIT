# Privacy, retention and deletion

Status: **draft** — the legal texts in `apps/app/src/legal/content.ts` have not been reviewed by a lawyer.
Operator identity, contact email and governing law are placeholders to complete before public launch.

## Data we hold
| Data | Where | Retention |
|---|---|---|
| Account (email, auth method, uid) | Firebase Authentication | until account deletion |
| Favorites, wishlist, collections, orders, shipments, tracking events, notifications, preferences | Firestore `users/{uid}/…` | until the user deletes it or the account |
| Consent records (`aiProcessing`, `terms`, policy version, timestamps) | Firestore `users/{uid}/consents/current` | deleted with the account |
| Price-watch subscriptions / alert events | Firestore `priceWatchSubscriptions`, `priceAlertEvents` (field `uid`) | deleted with the account |
| Affiliate click log (merchant, kind, time — **no product URL**) | Firestore `affiliateClicks` | purged after **90 days**; on account deletion the `uid` is removed (anonymized), the record is kept until the 90-day purge |
| AI daily usage counters | Firestore `users/{uid}/usage` | purged after ~35 days; deleted with the account |
| Rate-limit counters | Firestore `rateLimits` | purged hourly-daily (expireAt) |
| Read notifications | Firestore `users/{uid}/notifications` | purged after ~180 days |
| Screenshots / page text submitted for AI reading | **not stored** (processed in memory, sent to Anthropic) | n/a |
| Browser push subscriptions (endpoint + device keys) | Firestore `users/{uid}/pushSubscriptions` (server-only; keys never exported) | until the user turns push off, the push service reports the device gone, or the account is deleted |
| Client error reports (redacted message/stack, path without query, hashed user id) | Firestore `errorReports` (server-only) | purged after **30 days** |
| Global AI usage counter (no personal data) | Firestore `system/ai-YYYYMMDD` | purged after ~35 days |
| Extension session | `chrome.storage.local` in the user's browser | until disconnect/uninstall; refresh token revoked on account deletion |

## Controls
- **Export**: `GET /api/account/export` — everything under `users/{uid}` (all nesting levels) plus owned documents in shared collections, JSON.
- **Deletion**: `POST /api/account/delete` — requires a login from the last 5 minutes; deletes `users/{uid}` recursively, owned shared-collection docs,
  anonymizes affiliate clicks, then deletes the Firebase Auth user (revoking refresh tokens). Idempotent.
- **AI consent**: required server-side (`403 consent_required`) for AI reading; revocable in Settings → Privacy. Bumping `POLICY_VERSION`
  in `api/_lib/consent.ts` invalidates earlier acceptances.
- **Rate limiting**: per-user fixed windows (default 120/min; AI 20/min; export/delete 5/hour) enforced in `withAuth`.

## Documented exceptions to deletion
- Anonymized affiliate click records (no person link) kept ≤ 90 days for commission reconciliation / abuse analysis.
- Provider-side logs and backups (Vercel, Google Cloud) expire under their own schedules. Firestore backups / PITR are **not** enabled.
- Anything the law requires us to retain (none identified yet; to be confirmed by counsel).

## Cleanup job
`/api/cron/cleanup` (Vercel Cron, daily 03:17 UTC, `CRON_SECRET`) — bounded per run (400 docs per category), converges over runs.
Collection-group queries need the field overrides in `firestore.indexes.json`.

## Not covered / open
- Sentry-style error monitoring is not connected yet (needs an account); server logs deliberately contain only error class names.
- Hosting-provider request logs include IP addresses; retention follows Vercel's settings.

## Pickup distance (geocoding)
- A pickup address you saved is sent (address text only, no identifier) from our server to OpenStreetMap Nominatim to find its coordinates.
- Results, including "not found", are cached in `geocodeCache` (server-only) and purged after 180 days; coordinates are also stored on the shipment.
- Your own location is read in the browser only when you choose "Show distance from me"; it is used on the device to compute the distance and is **not sent to or stored by SHUPIT**.
