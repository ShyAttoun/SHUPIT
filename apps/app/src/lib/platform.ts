import { Alert, Linking, Platform } from 'react-native';

/** Cross-platform confirm dialog (Alert.alert is a no-op on react-native-web). */
export function confirmAction(opts: {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
}): Promise<boolean> {
  if (Platform.OS === 'web') {
    const text = opts.message ? `${opts.title}\n\n${opts.message}` : opts.title;
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(text) : false);
  }
  return new Promise((resolve) => {
    Alert.alert(
      opts.title,
      opts.message,
      [
        { text: opts.cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        { text: opts.confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/**
 * Store links (shop now, compare, an order's page at the store). On the web it opens a new tab; on phones it
 * opens the in-app browser (SFSafariViewController / Chrome Custom Tabs) rather than handing the link to the
 * store's own app: the web route keeps the affiliate link intact, and the browser shares the device's cookies,
 * saved logins and wallet. A "close" button brings the user back to SHUPIT. Falls back to the system handler.
 */
export async function openStore(url: string): Promise<void> {
  if (Platform.OS === 'web') return openExternal(url);
  try {
    const WebBrowser = await import('expo-web-browser');
    await WebBrowser.openBrowserAsync(url, { dismissButtonStyle: 'close', enableBarCollapsing: true });
  } catch {
    await Linking.openURL(url);
  }
}

/** Opens a link with the device's default handler (e.g. Waze). */
export async function openExternal(url: string): Promise<void> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  await Linking.openURL(url);
}
