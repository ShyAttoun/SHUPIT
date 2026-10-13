import type { Translations } from './en';

export const he: Translations = {
  common: {
    appName: 'SHUPIT',
    retry: 'נסו שוב',
    cancel: 'ביטול',
    loading: 'טוען…',
    somethingWrong: 'משהו השתבש',
    somethingWrongBody: 'לא הצלחנו לטעון. בדקו את החיבור ונסו שוב.',
  },
  tabs: {
    home: 'בית',
    stores: 'חנויות',
    wishlist: 'רשימת משאלות',
    orders: 'הזמנות',
  },
  header: {
    settings: 'פרופיל והגדרות',
  },
  home: {
    emptyTitle: 'עדיין אין משהו בדרך',
    emptyBody: 'הוסיפו הזמנה ואנחנו נעקוב אחריה כאן.',
  },
  stores: {
    emptyTitle: 'המועדפים שלך. בול במרכז.',
    emptyBody: 'החנויות שאתם אוהבים, במרחק נגיעה.',
  },
  wishlist: {
    emptyTitle: 'אהבתם? SHUPIT.',
    emptyBody: 'שומרים עכשיו. מחליטים אחר כך.',
  },
  orders: {
    emptyTitle: 'איפה הדבר הזה שקניתם?',
    emptyBody: 'כל הזמנה. כל עדכון. כאן.',
  },
  auth: {
    tagline: 'קונים בכל מקום. שומרים כאן.',
    signInTitle: 'ברוכים השבים',
    signUpTitle: 'יצירת חשבון',
    email: 'אימייל',
    password: 'סיסמה',
    signIn: 'התחברות',
    signUp: 'יצירת חשבון',
    continueWithGoogle: 'המשך עם Google',
    or: 'או',
    haveAccount: 'כבר יש לכם חשבון?',
    noAccount: 'חדשים ב-SHUPIT?',
    errors: {
      invalidEmail: 'הזינו כתובת אימייל תקינה',
      passwordShort: 'לפחות 8 תווים',
      invalidCredentials: 'האימייל או הסיסמה שגויים',
      emailInUse: 'כבר קיים חשבון עם האימייל הזה',
      tooManyRequests: 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.',
      network: 'אין חיבור. בדקו את הרשת ונסו שוב.',
      generic: 'לא הצלחנו להתחבר. נסו שוב.',
    },
  },
  settings: {
    title: 'פרופיל והגדרות',
    account: 'חשבון',
    language: 'שפה',
    languageSystem: 'לפי המכשיר',
    languageEnglish: 'English',
    languageHebrew: 'עברית',
    restartForRtl: 'הפעילו מחדש את האפליקציה כדי להחיל את כיוון הטקסט.',
    signOut: 'התנתקות',
  },
};
