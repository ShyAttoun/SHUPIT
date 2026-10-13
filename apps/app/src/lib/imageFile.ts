import type { PickedImage } from './imagePicker';

const MAX_WIDTH = 1280;
const MAX_BASE64_CHARS = 3_500_000;

/** Web only: resizes an image File/Blob to JPEG ≤ 1280px wide and returns base64. Throws if it can't. */
export async function fileToPicked(file: Blob): Promise<PickedImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  for (const q of [0.7, 0.5, 0.35]) {
    const base64 = canvas.toDataURL('image/jpeg', q).split(',')[1];
    if (base64 && base64.length <= MAX_BASE64_CHARS) return { base64, mediaType: 'image/jpeg' };
  }
  throw new Error('too large');
}
