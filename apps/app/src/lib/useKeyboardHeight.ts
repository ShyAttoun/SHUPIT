import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';

/**
 * Height of the on-screen keyboard (0 when hidden or on web). Lets overlays and sheets lift their
 * content above the keyboard, on both iOS and (edge-to-edge) Android.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillChangeFrame' : 'keyboardDidShow', (e) => {
      const h = ios ? Math.max(0, Dimensions.get('window').height - e.endCoordinates.screenY) : e.endCoordinates.height;
      setHeight(h);
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}
