import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '@/design';
import { fileToPicked } from '@/lib/imageFile';
import type { ImageDropZoneProps } from './ImageDropZone';

/** Web: drag & drop, paste (Ctrl/Cmd+V) or click to choose a screenshot. */
export function ImageDropZone({ label, hint, busy, onImage, onError }: ImageDropZoneProps) {
  const theme = useTheme();
  const { colors, spacing, radius } = theme;
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
        fontFamily: theme.textStyle('body').fontFamily,
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
