# Sign in with Apple on the web/PWA

The button is **hidden until configured** (never a non-working button). To enable:

1. **Apple Developer → Identifiers → Services IDs**: create a Services ID (e.g. `il.co.shupit.web`), enable *Sign in with Apple*, add domain `shupit-8a4f5.firebaseapp.com` and return URL `https://shupit-8a4f5.firebaseapp.com/__/auth/handler`.
2. **Apple Developer → Keys**: create a key with *Sign in with Apple*, note the Key ID and download the `.p8`.
3. **Firebase Console → Authentication → Sign-in method → Apple**: enable; paste Services ID, Team ID, Key ID and the private key.
4. **Vercel (project shupit) → Environment Variables**: `EXPO_PUBLIC_APPLE_WEB_ENABLED=1` (Production), redeploy.

Implementation notes
- iOS Safari / installed PWA use `signInWithRedirect` (popups are unreliable); other browsers use a popup. `getRedirectResult` completes the sign-in on return.
- Apple may hide the email (private relay) and sends the name only on the first sign-in; the app does not depend on either.
- An account that already exists with the same email under another provider shows a clear message (`auth/account-exists-with-different-credential`) instead of creating a duplicate.
- Native iOS uses `expo-apple-authentication` (see `docs/NATIVE.md`).
