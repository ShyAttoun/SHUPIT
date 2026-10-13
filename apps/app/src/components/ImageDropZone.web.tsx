import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '@/design';
import type { PickedImage } from '@/lib/imagePicker';
import type { ImageDropZoneProps } from './ImageDropZone';

const MAX_WIDTH = 1280;
const MAX_BASE64_CHARS = 3_500_000;

/** Resizes an image file to JPEG ≤ 1280px wide and returns base64. Throws if it can't. */
async function fileToPicked(file: File): Promise<PickedImage> {
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

/** Web: drag & drop, paste (Ctrl/Cmd+V) or click to choose a screenshot. */
export function ImageDropZone({ label, hint, busy, onImage, onError }: ImageDropZoneProps) {
  const { colors, spacing, radius } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handleFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file || !file.type.startsWith('image/')) {
        onError?.();
        return;
      }
      try {
        onImage(await fileToPicked(file));
      } catch {
        onError?.();
      }
    },
    [onImage, onError],
  );

  // Paste an image straight from the clipboard (e.g. after a screenshot).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
      if (file) {
        e.preventDefault();
        void handleFile(file);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handleFile]);

  const open = () => {
    if (!busy) inputRef.current?.click();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-busy={busy}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void handleFile(e.dataTransfer.files[0]);
      }}
      style={{
        minHeight: 132,
        padding: spacing.md,
        borderRadius: radius.lg,
        border: `2px dashed ${over ? colors.accentStrong : colors.accent}`,
        backgroundColor: over ? colors.accentSoft : colors.surface,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        textAlign: 'center',
        cursor: busy ? 'default' : 'pointer',
        opacity: busy ? 0.6 : 1,
        color: colors.text,
        outlineOffset: 2,
        transition: 'background-color 120ms',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 16 }}>{label}</div>
      {hint ? <div style={{ fontSize: 14, color: colors.textSecondary }}>{hint}</div> : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
