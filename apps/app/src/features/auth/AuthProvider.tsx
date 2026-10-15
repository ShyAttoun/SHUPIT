import {
  GoogleAuthProvider,
  OAuthProvider,
  getRedirectResult,
  sendPasswordResetEmail,
  signInWithRedirect,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { auth } from '@/lib/auth';
import { useNativeAuth } from './nativeAuth';

type Status = 'loading' | 'signedIn' | 'signedOut';

interface AuthContextValue {
  status: Status;
  user: User | null;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  /** Web: popup. Native: ID-token flow when the OAuth client ids are configured. */
  googleSupported: boolean;
  /** iOS only (App Store rule: required whenever another social login is offered). */
  signInWithApple: () => Promise<void>;
  /** Native (iOS) or web when the Apple services id is configured (EXPO_PUBLIC_APPLE_WEB_ENABLED=1). */
  appleSupported: boolean;
  /** Sends the standard password-reset email. Always resolves the same way (does not reveal accounts). */
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const native = useNativeAuth();

  // Completes a redirect-based sign-in (Apple on iOS Safari / PWA) when the page loads again.
  useEffect(() => {
    if (Platform.OS === 'web') void getRedirectResult(auth).catch(() => undefined);
  }, []);

  useEffect(
    () =>
      onAuthStateChanged(auth, (next) => {
        setUser(next);
        setStatus(next ? 'signedIn' : 'signedOut');
      }),
    [],
  );

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  }, []);
  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  }, []);
  const { signInWithGoogleNative, signInWithAppleNative } = native;
  const signInWithGoogle = useCallback(async () => {
    if (Platform.OS === 'web') await signInWithPopup(auth, new GoogleAuthProvider());
    else await signInWithGoogleNative();
  }, [signInWithGoogleNative]);
  const signInWithApple = useCallback(async () => {
    if (Platform.OS !== 'web') return signInWithAppleNative();
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    // Popups are unreliable in iOS Safari and in an installed PWA: use a full-page redirect there.
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const preferRedirect = /iPad|iPhone|iPod/.test(ua);
    if (preferRedirect) await signInWithRedirect(auth, provider);
    else await signInWithPopup(auth, provider);
  }, [signInWithAppleNative]);
  const resetPassword = useCallback(async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (e) {
      // An unknown address must look the same as a known one.
      const code = (e as { code?: string }).code;
      if (code !== 'auth/user-not-found' && code !== 'auth/invalid-credential') throw e;
    }
  }, []);
  const signOut = useCallback(() => fbSignOut(auth), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      googleSupported: Platform.OS === 'web' || native.googleSupported,
      signInWithApple,
      appleSupported: Platform.OS === 'web' ? process.env.EXPO_PUBLIC_APPLE_WEB_ENABLED === '1' : native.appleSupported,
      resetPassword,
      signOut,
    }),
    [status, user, signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple, resetPassword, native.googleSupported, native.appleSupported, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
