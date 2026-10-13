import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export interface PickedImage {
  base64: string;
  mediaType: 'image/jpeg';
}

const MAX_WIDTH = 1280;
const MAX_BASE64_CHARS = 3_500_000; // keeps the request well under the 4.5MB platform limit

/**
 * Lets the user choose a screenshot, downsizes it and returns base64 JPEG.
 * Returns null when cancelled. Throws when the image cannot be processed.
 */
export async function pickScreenshot(): Promise<PickedImage | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: 1,
  });
  if (res.canceled || !res.assets[0]) return null;
  const asset = res.assets[0];

  for (const compress of [0.7, 0.5, 0.35]) {
    const out = await ImageManipulator.manipulateAsync(
      asset.uri,
      asset.width > MAX_WIDTH ? [{ resize: { width: MAX_WIDTH } }] : [],
      { compress, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    if (out.base64 && out.base64.length <= MAX_BASE64_CHARS) {
      return { base64: out.base64, mediaType: 'image/jpeg' };
    }
  }
  throw new Error('image too large');
}
