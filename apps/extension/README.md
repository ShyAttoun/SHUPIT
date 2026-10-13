# SHUPIT Chrome extension (MV3)

Save products and add orders / update shipment status from the page you are looking at.
Because it runs in your own browser session, it can read pages that need a login or that
block server-side fetching.

## Build & install (development)
```bash
npm run build -w @shupit/extension   # → apps/extension/dist
```
Chrome → `chrome://extensions` → enable *Developer mode* → *Load unpacked* → pick `apps/extension/dist`.
The manifest carries a fixed public `key`, so the extension ID is stable: `mfakokjcfhoiphhjiennhdkkicbmdgmn`
(exposed to the web app as `EXPO_PUBLIC_EXTENSION_ID`). Publishing to the Chrome Web Store assigns a new ID.

## Connect
Open SHUPIT → Settings → **Connect Chrome extension**. The web app hands the signed-in session to the
extension (works for any sign-in method). The extension only accepts messages from origins listed in
`externally_connectable` and `src/config.ts`.

## Privacy / permissions
- `activeTab` + `scripting`: the page is read only after you press an action in the popup.
- `storage`: keeps the session locally (`chrome.storage.local`, not synced).
- Host permissions: SHUPIT API and Google token refresh only. No access to other sites' data in the background.
- Never reads form fields, cookies, passwords or payment data. Order/tracking pages are sent without the query string.
