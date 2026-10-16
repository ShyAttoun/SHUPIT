import { getShareExtensionKey } from 'expo-share-intent';

/**
 * The iOS Share Extension opens the app with a private deep link
 * (`shupit://dataUrl=<key>?nonce=…`). It is not a screen: the shared content is read by
 * `useNativeShare`, so send the router to Home instead of an "Unmatched Route" page.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    if (path.includes(`dataUrl=${getShareExtensionKey()}`) || path.includes('dataUrl=shupitShareKey')) {
      return '/';
    }
    return path;
  } catch {
    return '/';
  }
}
