/** Web: native sign-in is not used (the browser flows live in AuthProvider). Native overrides this file. */
export interface NativeAuth {
  googleSupported: boolean;
  appleSupported: boolean;
  signInWithGoogleNative: () => Promise<void>;
  signInWithAppleNative: () => Promise<void>;
}

export function useNativeAuth(): NativeAuth {
  return {
    googleSupported: false,
    appleSupported: false,
    signInWithGoogleNative: async () => undefined,
    signInWithAppleNative: async () => undefined,
  };
}
