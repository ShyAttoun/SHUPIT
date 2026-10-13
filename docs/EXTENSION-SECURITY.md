# Chrome extension: security review

Reviewed: 2026-10-14 (self-review; no external audit). Manifest V3.

## Permissions
| Permission | Why | Narrower alternative considered |
|---|---|---|
| `activeTab` | Read/screenshot the current tab **only after the user clicks an action** in the popup. | Content scripts on all sites: rejected (always-on access). |
| `scripting` | Inject one self-contained function (`readPage`) into the active tab. | — |
| `storage` | Keep the SHUPIT session and the current job in `chrome.storage.local` (not synced). | — |
| host `https://shupit.vercel.app/*` | Call the SHUPIT API. | — |
| host `https://securetoken.googleapis.com/*` | Refresh the Firebase ID token. | — |
| `externally_connectable` `https://shupit.vercel.app/*` | The web app hands over the signed-in session. | Production builds contain **no** `localhost` match (dev build only: `node build.mjs --dev`). |

No `<all_urls>`, no `tabs` permission, no `cookies`, no `webRequest`, no remote code, no `web_accessible_resources`, default MV3 CSP.

## What the page-reader sends
Visible text (≤ 30 000 chars), structured product data (JSON-LD/meta), image URLs with nearby text, and for order/tracking
pages a JPEG of the visible area. Order/tracking URLs are sent **without query string**. It never reads form fields, cookies,
local/session storage, passwords or payment details.

## Threat model
| Threat | Mitigation | Residual risk |
|---|---|---|
| Malicious site tries to steal the session via the external message API | Messages accepted only from allow-listed origins; the extension never sends session data in a response | A compromise of `shupit.vercel.app` itself (XSS) could connect/disconnect the extension and read nothing back, but could trigger actions → app CSP hardening is open (see checklist) |
| Another extension reads `chrome.storage.local` | Not possible without the `storage` permission on this extension; Chrome isolates extension storage | Local malware / user-profile compromise is out of scope |
| Stolen refresh token | Stored only in `chrome.storage.local`; revoked when the account is deleted or password changed; disconnect clears it | Token is not encrypted at rest (platform limitation) |
| Page content prompt-injects the AI | Page text is passed as untrusted data, output is schema-validated, image URLs must exist in the page, user confirms before save | AI can still mis-read; user review step is the control |
| Extension used to scrape on a user's behalf at scale | Per-user rate limits (20 AI calls/min, 30/day, global daily cap) | — |
| Wrong site "connects" the extension | `sender.origin` is checked in the service worker | — |

## Open items
- Add a Content-Security-Policy header to the web app (currently only nosniff / frame / referrer headers).
- Chrome Web Store listing requires a privacy policy URL, single-purpose description and permission justifications (use the table above).
