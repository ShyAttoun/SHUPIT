import type { Translations } from '@/i18n/locales/en';

type AuthErrorKey = keyof Translations['auth']['errors'];

/** Maps Firebase Auth error codes to a translation key. Never leaks raw codes to UI. */
export function authErrorKey(error: unknown): AuthErrorKey {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials':
      return 'invalidCredentials';
    case 'auth/email-already-in-use':
      return 'emailInUse';
    case 'auth/invalid-email':
      return 'invalidEmail';
    case 'auth/weak-password':
      return 'passwordShort';
    case 'auth/too-many-requests':
      return 'tooManyRequests';
    case 'auth/network-request-failed':
      return 'network';
    case 'auth/account-exists-with-different-credential':
      return 'accountExists';
    default:
      return 'generic';
  }
}
