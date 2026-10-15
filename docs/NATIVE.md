# SHUPIT native apps (iOS / Android)

The app is Expo (React Native). Native projects are **generated** (`expo prebuild`) — they are not committed.
`apps/app/app.json` holds the config; `apps/app/eas.json` the build profiles.

## What is in place
- Bundle id / package: `il.co.shupit.app` · universal/app links for `app.shupit.co.il` · icon + adaptive icon.
- **Auth:** email/password (shared), Google via ID-token flow, Sign in with Apple (iOS; App Store requires it when another social login is offered). All end in a Firebase credential.
- **Push:** `expo-notifications` → Expo push token → `POST /api/account/push {expoToken}` → server sends via the Expo push service (`api/_lib/push.ts`). Tapping a push opens its `url`.
- **Share to SHUPIT:** `expo-share-intent` (iOS Share Extension, Android intent filters) → `/share?from=native`.
- **Pictures:** product thumbnails are cut with `expo-image-manipulator` (same as web canvas).
- Clipboard (`expo-clipboard`), image picker, location (on demand), Waze/Maps links.

## What you must provide (cannot be done from code)
| Item | Where |
|---|---|
| EAS project | `cd apps/app && eas init` (writes `extra.eas.projectId` into app.json; push needs it) |
| Google OAuth client ids | Google Cloud → Credentials: an **iOS** client (bundle id above) and an **Android** client (package + SHA-1 from `eas credentials`) and the **Web** client. Set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (EAS env / `.env`). Without them the Google button is hidden on native. For iOS also add the reversed client id as a URL scheme. |
| Sign in with Apple | Apple Developer → Identifiers → enable "Sign in with Apple" for the bundle id; Firebase → Authentication → Apple → enable |
| Push credentials | `eas credentials` creates the APNs key / FCM v1 key |
| `.well-known` files | `apple-app-site-association` and `assetlinks.json` on `app.shupit.co.il` (Team ID + SHA-256 fingerprints) |
| Reviewer test account | email + password (Google/Apple are not usable by reviewers) |

## Build
```
cd apps/app
eas build --profile development --platform ios      # dev client for a device/simulator
eas build --profile preview --platform android       # installable APK
eas build --profile production --platform all
eas submit --platform ios   # TestFlight → App Store
```

## Verified so far
- `expo export` bundles for **ios** and **android** (JS compiles for native).
- `expo prebuild` generates both native projects with all config plugins (incl. the iOS Share Extension).
- **Not yet verified:** an actual native compile and a run on a device/simulator, Google/Apple sign-in, push delivery, share extension, deep links.

## Store policy notes
See the compliance discussion in the project history: privacy policy URL must be real, account deletion must be reachable in-app and via a public web URL (Play), App Privacy / Data Safety forms must mention AI processing, screenshots/thumbnails and location; keep merchant names out of store metadata.
