import { Platform } from 'react-native';

/**
 * Android's back button (and the browser back button) closes a PWA when it was opened straight on an
 * inner screen — a push notification, a share, a deep link — because there is nothing beneath it in the
 * history. Insert Home beneath such a first entry so back goes Home instead of leaving the app.
 */
export function ensureHomeBeneath(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    // Once per tab/launch: reloads and in-app navigation must not insert it again.
    if (window.sessionStorage.getItem('shupit.entered')) return;
    window.sessionStorage.setItem('shupit.entered', '1');
    const { pathname, search, hash } = window.location;
    if (pathname === '/' || pathname === '') return;
    window.history.replaceState(window.history.state, '', '/');
    window.history.pushState(window.history.state, '', `${pathname}${search}${hash}`);
  } catch {
    // history unavailable: keep the default behaviour
  }
}
