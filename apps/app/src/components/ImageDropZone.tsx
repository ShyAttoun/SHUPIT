import { ImagePlus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Text, useTheme } from '@/design';
import { pickScreenshot, type PickedImage } from '@/lib/imagePicker';

export interface ImageDropZoneProps {
  label: string;
  hint?: string;
  busy?: boolean;
  onImage: (image: PickedImage) => void;
  onError?: () => void;
}

/** Native: tap to choose from the photo library. (The web build has drag & drop and paste.) */
export function ImageDropZone({ label, hint, busy, onImage, onError }: ImageDropZoneProps) {
  const { colors, spacing, radius, hitTarget } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy}
      onPress={async () => {
        try {
          const picked = await pickScreenshot();
          if (picked) onImage(picked);
        } catch {
          onError?.();
        }
      }}
      style={({ pressed }) => ({
        minHeight: hitTarget + 48,
        padding: spacing.md,
        borderRadius: radius.lg,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: colors.accent,
        backgroundColor: colors.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        opacity: busy ? 0.6 : pressed ? 0.85 : 1,
      })}
    >
      <ImagePlus size={28} color={colors.accentText} />
      <Text variant="bodyStrong" style={{ textAlign: 'center' }}>
        {label}
      </Text>
      {hint ? (
        <Text variant="small" color="textSecondary" style={{ textAlign: 'center' }}>
          {hint}
        </Text>
      ) : null}
      <View />
    </Pressable>
  );
}
