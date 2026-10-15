import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, OAuthProvider, signInWithCredential } from 'firebase/auth';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { auth } from '@/lib/auth';
import type { NativeAuth } from './nativeAuth';

WebBrowser.maybeCompleteAuthSession();

// OAuth client ids come from Google Cloud (Credentials). Without them Google sign-in is hidden.
const IOS_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const ANDROID_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const WEB_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const googleConfigured = Platform.OS === 'ios' ? !!IOS_ID : !!ANDROID_ID;

/**
 * iOS: Sign in with Apple (required by App Store rules whenever another social login is offered)
 * and Google. Android: Google. Both end in a Firebase credential, so the rest of the app is unchanged.
 */
export function useNativeAuth(): NativeAuth {
  const [appleSupported, setAppleSupported] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let alive = true;
    void AppleAuthentication.isAvailableAsync().then((ok) => alive && setAppleSupported(ok));
    return () => {
      alive = false;
    };
  }, []);

  // The hook needs a client id for this platform; placeholders keep it mounted when not configured.
  const [, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: IOS_ID ?? 'unset.apps.googleusercontent.com',
    androidClientId: ANDROID_ID ?? 'unset.apps.googleusercontent.com',
    webClientId: WEB_ID,
  });
  const pending = useRef<{ resolve: () => void; reject: (e: unknown) => void } | null>(null);

  useEffect(() => {
    if (!response || !pending.current) return;
    const p = pending.current;
    if (response.type === 'success') {
      const idToken = response.params.id_token ?? response.authentication?.idToken;
      if (!idToken) {
        pending.current = null;
        p.reject(new Error('no id token'));
        return;
      }
      pending.current = null;
      signInWithCredential(auth, GoogleAuthProvider.credential(idToken)).then(p.resolve, p.reject);
    } else if (response.type === 'dismiss' || response.type === 'cancel') {
      pending.current = null;
      p.reject(Object.assign(new Error('cancelled'), { code: 'auth/popup-closed-by-user' }));
    } else if (response.type === 'error') {
      pending.current = null;
      p.reject(response.error ?? new Error('google error'));
    }
  }, [response]);

  return {
    googleSupported: googleConfigured,
    appleSupported,
    signInWithGoogleNative: () =>
      new Promise<void>((resolve, reject) => {
        pending.current = { resolve, reject };
        void promptAsync().catch((e) => {
          pending.current = null;
          reject(e);
        });
      }),
    signInWithAppleNative: async () => {
      // Nonce: Apple receives the hash, Firebase verifies the raw value.
      const rawNonce = Array.from(await Crypto.getRandomBytesAsync(16), (b) => b.toString(16).padStart(2, '0')).join('');
      const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      try {
        const cred = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
          nonce: hashed,
        });
        if (!cred.identityToken) throw new Error('no identity token');
        const provider = new OAuthProvider('apple.com');
        await signInWithCredential(auth, provider.credential({ idToken: cred.identityToken, rawNonce }));
      } catch (e) {
        if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
          throw Object.assign(new Error('cancelled'), { code: 'auth/popup-closed-by-user' });
        }
        throw e;
      }
    },
  };
}
