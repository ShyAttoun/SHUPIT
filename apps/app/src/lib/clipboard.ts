import { Platform } from 'react-native';

/** Copies text on web and native. Returns false when the platform refuses. */
export async function copyToClipboard(value: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
      await navigator.clipboard.writeText(value);
      return true;
    }
    const Clipboard = await import('expo-clipboard');
    await Clipboard.setStringAsync(value);
    return true;
  } catch {
    return false;
  }
}
