export const en = {
  common: {
    appName: 'SHUPIT',
    retry: 'Try again',
    cancel: 'Cancel',
    loading: 'Loading…',
    somethingWrong: 'Something went wrong',
    somethingWrongBody: 'We couldn’t load this. Check your connection and try again.',
  },
  tabs: {
    home: 'Home',
    stores: 'Stores',
    wishlist: 'Wishlist',
    orders: 'Orders',
  },
  header: {
    settings: 'Profile and settings',
  },
  home: {
    emptyTitle: 'Nothing on its way yet',
    emptyBody: 'Add an order and we’ll track it right here.',
  },
  stores: {
    emptyTitle: 'Your favorites. Front and center.',
    emptyBody: 'The stores you love, one tap away.',
  },
  wishlist: {
    emptyTitle: 'Love it? SHUPIT.',
    emptyBody: 'Save it now. Decide later.',
  },
  orders: {
    emptyTitle: 'Where’s that thing you bought?',
    emptyBody: 'Every order. Every update. Right here.',
  },
  auth: {
    tagline: 'Shop everywhere. Keep it here.',
    signInTitle: 'Welcome back',
    signUpTitle: 'Create your account',
    email: 'Email',
    password: 'Password',
    signIn: 'Sign in',
    signUp: 'Create account',
    continueWithGoogle: 'Continue with Google',
    or: 'or',
    haveAccount: 'Already have an account?',
    noAccount: 'New to SHUPIT?',
    errors: {
      invalidEmail: 'Enter a valid email address',
      passwordShort: 'Use at least 8 characters',
      invalidCredentials: 'Email or password is incorrect',
      emailInUse: 'An account with this email already exists',
      tooManyRequests: 'Too many attempts. Try again in a few minutes.',
      network: 'No connection. Check your network and try again.',
      generic: 'We couldn’t sign you in. Try again.',
    },
  },
  settings: {
    title: 'Profile and settings',
    account: 'Account',
    language: 'Language',
    languageSystem: 'Device default',
    languageEnglish: 'English',
    languageHebrew: 'עברית',
    restartForRtl: 'Restart the app to apply the new text direction.',
    signOut: 'Sign out',
  },
};

export type Translations = typeof en;
