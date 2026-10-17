import { getShareExtensionKey } from 'expo-share-intent';

/**
 * The iOS Share Extension opens the app with a private deep link
 * (`shupit://dataUrl=<key>?nonce=…`). It is not a screen: the shared content is read by
 * `useNativeShare`, so send the router to Home instead of an "Unmatched Route" page.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    // Share-extension hand-off (cold start or while the app is open): never a screen, always Home.
    if (path.includes('dataUrl=') || path.includes(getShareExtensionKey())) {
      return '/';
    }
    return path;
  } catch {
    return '/';
  }
}
