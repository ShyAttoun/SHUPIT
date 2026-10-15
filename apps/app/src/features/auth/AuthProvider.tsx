import {
  GoogleAuthProvider,
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
  appleSupported: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const native = useNativeAuth();

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
  const signInWithApple = useCallback(() => signInWithAppleNative(), [signInWithAppleNative]);
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
      appleSupported: native.appleSupported,
      signOut,
    }),
    [status, user, signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple, native.googleSupported, native.appleSupported, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
