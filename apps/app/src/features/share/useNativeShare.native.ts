import * as ImageManipulator from 'expo-image-manipulator';
import { useShareIntent } from 'expo-share-intent';
import { useEffect } from 'react';
import { useIncomingShare } from '@/lib/incomingShare';

/**
 * Receives what the user shares from other apps (Share → SHUPIT): links, text and pictures.
 * Pictures are reduced to the same small JPEG the in-app picker produces before leaving this hook.
 */
export function useNativeShare(): void {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
  const set = useIncomingShare((s) => s.set);

  useEffect(() => {
    if (!hasShareIntent) return;
    let cancelled = false;
    void (async () => {
      const file = shareIntent.files?.find((f) => f.mimeType?.startsWith('image/'));
      let image: { base64: string; mediaType: 'image/jpeg' } | undefined;
      if (file?.path) {
        try {
          const out = await ImageManipulator.manipulateAsync(
            file.path,
            file.width && file.width > 1280 ? [{ resize: { width: 1280 } }] : [],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
          );
          if (out.base64 && out.base64.length <= 3_500_000) image = { base64: out.base64, mediaType: 'image/jpeg' };
        } catch {
          // unreadable picture: fall back to text/link only
        }
      }
      if (cancelled) return;
      set({
        text: shareIntent.text ?? undefined,
        url: shareIntent.webUrl ?? undefined,
        ...(image ? { image } : {}),
      });
      resetShareIntent();
    })();
    return () => {
      cancelled = true;
    };
  }, [hasShareIntent, shareIntent, resetShareIntent, set]);
}
