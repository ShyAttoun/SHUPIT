import { Platform } from 'react-native';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Validates a box reported by the model (fractions of the screenshot) and clamps it to the image.
 * Rejects boxes that are tiny, extremely elongated or not numbers: those are mistakes, not pictures.
 */
export function sanitizeBox(box: Partial<Box> | null | undefined): Box | null {
  if (!box) return null;
  const { x, y, w, h } = box;
  if (![x, y, w, h].every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
  const cx = Math.max(0, Math.min(1, x!));
  const cy = Math.max(0, Math.min(1, y!));
  const cw = Math.min(w!, 1 - cx);
  const ch = Math.min(h!, 1 - cy);
  if (cw < 0.06 || ch < 0.06) return null;
  const ratio = cw / ch;
  if (ratio > 4 || ratio < 0.25) return null;
  return { x: cx, y: cy, w: cw, h: ch };
}

/** Grows a box by `p` of the image on every side, staying inside the image. */
export function padBox(b: Box, p: number): Box {
  const x = Math.max(0, b.x - p);
  const y = Math.max(0, b.y - p);
  return { x, y, w: Math.min(1 - x, b.w + 2 * p), h: Math.min(1 - y, b.h + 2 * p) };
}

/**
 * Web only. Cuts the box out of the screenshot and returns a small square-ish JPEG data URL
 * (kept under `maxChars`), or null when it cannot be produced.
 */
export async function cropThumbnail(
  imageBase64: string,
  mediaType: string,
  box: Partial<Box> | null | undefined,
  opts: { size?: number; maxChars?: number } = {},
): Promise<string | null> {
  const raw = sanitizeBox(box);
  // A little margin: the model's boxes tend to be tight and clip the edges of the picture.
  const b = raw ? padBox(raw, 0.06) : null;
  if (!b) return null;
  if (Platform.OS !== 'web') return cropThumbnailNative(imageBase64, mediaType, b, opts);
  if (typeof document === 'undefined') return null;
  const size = opts.size ?? 256;
  const maxChars = opts.maxChars ?? 40_000;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode'));
      el.src = `data:${mediaType};base64,${imageBase64}`;
    });
    const sx = b.x * img.naturalWidth;
    const sy = b.y * img.naturalHeight;
    const sw = b.w * img.naturalWidth;
    const sh = b.h * img.naturalHeight;
    const scale = Math.min(1, size / Math.max(sw, sh));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw * scale));
    canvas.height = Math.max(1, Math.round(sh * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    for (const q of [0.78, 0.62, 0.48]) {
      const url = canvas.toDataURL('image/jpeg', q);
      if (url.length <= maxChars) return url;
    }
    return null;
  } catch {
    return null;
  }
}

/** Native: same crop with the image manipulator. Returns a JPEG data URL, or null. */
async function cropThumbnailNative(
  imageBase64: string,
  mediaType: string,
  b: Box,
  opts: { size?: number; maxChars?: number },
): Promise<string | null> {
  try {
    const ImageManipulator = await import('expo-image-manipulator');
    const uri = `data:${mediaType};base64,${imageBase64}`;
    // A no-op pass gives the real pixel size.
    const probe = await ImageManipulator.manipulateAsync(uri, [], { format: ImageManipulator.SaveFormat.JPEG });
    const sw = Math.round(b.w * probe.width);
    const sh = Math.round(b.h * probe.height);
    const scale = Math.min(1, (opts.size ?? 256) / Math.max(sw, sh));
    const maxChars = opts.maxChars ?? 40_000;
    for (const compress of [0.78, 0.62, 0.48]) {
      const out = await ImageManipulator.manipulateAsync(
        uri,
        [
          { crop: { originX: Math.round(b.x * probe.width), originY: Math.round(b.y * probe.height), width: sw, height: sh } },
          { resize: { width: Math.max(1, Math.round(sw * scale)) } },
        ],
        { compress, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      if (out.base64) {
        const url = `data:image/jpeg;base64,${out.base64}`;
        if (url.length <= maxChars) return url;
      }
    }
    return null;
  } catch {
    return null;
  }
}
