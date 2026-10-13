/**
 * LEGAL TEXT — DRAFT. Written to match what the product actually does, but it has NOT been
 * reviewed by a lawyer. Operator identity, contact details and governing law must be completed
 * before public launch. Bump POLICY_VERSION in api/_lib/consent.ts when this changes materially.
 */
export type LegalDocId = 'privacy' | 'terms' | 'affiliate';
export type LegalLang = 'en' | 'he';

export interface LegalDoc {
  title: string;
  updated: string;
  draft: string;
  sections: { heading: string; body: string[] }[];
}

const CONTACT = process.env.EXPO_PUBLIC_CONTACT_EMAIL || '[contact email — to be completed]';
const OPERATOR_EN = '[operator name and address — to be completed before public launch]';
const OPERATOR_HE = '[שם המפעיל וכתובתו — יושלמו לפני ההשקה לציבור]';

export const legalDocs: Record<LegalDocId, Record<LegalLang, LegalDoc>> = {
  privacy: {
    en: {
      title: 'Privacy Policy',
      updated: 'Version 2026-10-14',
      draft: 'Draft — not yet reviewed by a lawyer.',
      sections: [
        {
          heading: 'Who we are',
          body: [
            `SHUPIT is a personal shopping companion: favorite stores, a wishlist, orders and delivery tracking in one place. Operator: ${OPERATOR_EN}. Contact: ${CONTACT}.`,
            'SHUPIT does not sell products and does not process payments. Checkout and payment always happen with the store.',
          ],
        },
        {
          heading: 'What we collect',
          body: [
            'Account: your email address, how you sign in (email and password, or Google) and a unique account ID. Passwords are handled by Firebase Authentication and are never visible to us.',
            'Content you add: favorite stores; saved products (title, link, picture link, price, notes, collections); orders (store, order number, date, total, items, delivery details); shipments (carrier, tracking number, status, delivery estimates, tracking events); notifications and preferences.',
            'Information read from screenshots and pages: only the fields extracted from them are saved. The screenshot or page text itself is processed in memory and is not stored by us.',
            'Technical data: IP address and browser or device information are processed by our hosting infrastructure to deliver the service and keep it secure.',
          ],
        },
        {
          heading: 'AI processing of screenshots and pages',
          body: [
            'When you upload a screenshot, paste a link, or use the Chrome extension to add an order, a product or a tracking update, the image or the visible text of the page is sent to Anthropic’s API so it can be read. Such content may include personal details that appear on the page, such as your name, address, phone number and order contents.',
            'The result is shown to you to check before it is saved. We do not store the screenshot or page text. AI can make mistakes, so please verify what was read.',
            'We use AI processing only with your consent. You can withdraw it at any time in Settings → Privacy; the AI-based features will then stop working until you agree again.',
          ],
        },
        {
          heading: 'Chrome extension',
          body: [
            'The extension reads the page you are on only when you press an action in its window. It reads visible text, structured product data and picture links, and a screenshot of the visible area for orders and tracking pages; it does not read form fields, cookies, passwords or payment details. For order and tracking pages the web address is sent without its query string.',
            'The extension stores your SHUPIT session locally in your browser and uses it only to talk to SHUPIT. You can disconnect it in Settings.',
          ],
        },
        {
          heading: 'Service providers',
          body: [
            'Google (Firebase Authentication and Cloud Firestore) stores account and app data. Our database is located in the Israel region (me-west1).',
            'Vercel hosts the website and APIs (functions run in the Frankfurt region).',
            'Anthropic processes screenshots and page text for AI reading, under its own terms and retention policies.',
            'Google’s icon service is used to show store icons; only the store’s domain is sent.',
            'We do not sell your personal data and we do not use it for advertising.',
          ],
        },
        {
          heading: 'Affiliate links',
          body: [
            'When you open a store through SHUPIT we may use an affiliate link if an affiliate programme is active for that store. We record the store, the time, and whether an affiliate link was used. We do not record the product address in this log.',
          ],
        },
        {
          heading: 'How long we keep data',
          body: [
            'Account content: until you delete it or your account.',
            'Affiliate click records: up to 90 days (and anonymized if you delete your account).',
            'Daily usage counters: about 35 days. Read notifications: about 180 days. Rate-limit counters: a few minutes to hours.',
            'Hosting and error logs follow the retention settings of the hosting provider; our own logs avoid personal content.',
          ],
        },
        {
          heading: 'Your choices and rights',
          body: [
            'Export: Settings → Privacy → Export my data gives you a machine-readable file of the data we hold.',
            'Delete: Settings → Privacy → Delete my account permanently removes your content and your login. Some records may remain for a limited time where described above (anonymized affiliate click records) or in provider backups and logs until they expire.',
            `For any other request (access, correction, objection), contact ${CONTACT}.`,
          ],
        },
        {
          heading: 'Security',
          body: [
            'Data is encrypted in transit. Access to your data is restricted to your account by database security rules and server-side authorization. No system is perfectly secure; please tell us about any problem you notice.',
          ],
        },
        {
          heading: 'Children',
          body: ['SHUPIT is not intended for people under 16.'],
        },
        {
          heading: 'Changes',
          body: [
            'If this policy changes in a material way we will update the version above and ask for your consent again where required.',
          ],
        },
      ],
    },
    he: {
      title: 'מדיניות פרטיות',
      updated: 'גרסה 2026-10-14',
      draft: 'טיוטה — טרם נבדקה על ידי עורך דין.',
      sections: [
        {
          heading: 'מי אנחנו',
          body: [
            `SHUPIT הוא עוזר קניות אישי: חנויות מועדפות, רשימת משאלות, הזמנות ומעקב משלוחים במקום אחד. המפעיל: ${OPERATOR_HE}. יצירת קשר: ${CONTACT}.`,
            'SHUPIT אינו מוכר מוצרים ואינו מעבד תשלומים. התשלום וההזמנה מתבצעים תמיד מול החנות.',
          ],
        },
        {
          heading: 'איזה מידע אנחנו אוספים',
          body: [
            'חשבון: כתובת האימייל שלכם, אופן ההתחברות (אימייל וסיסמה או Google) ומזהה חשבון ייחודי. סיסמאות מטופלות על ידי Firebase Authentication ואינן גלויות לנו.',
            'תוכן שאתם מוסיפים: חנויות מועדפות; מוצרים שמורים (שם, קישור, קישור לתמונה, מחיר, הערות, אוספים); הזמנות (חנות, מספר הזמנה, תאריך, סכום, פריטים, פרטי משלוח); משלוחים (חברת שילוח, מספר מעקב, סטטוס, הערכות הגעה, אירועי מעקב); התראות והעדפות.',
            'מידע שנקרא מצילומי מסך ומדפים: נשמרים רק השדות שחולצו. צילום המסך או טקסט הדף עצמם מעובדים בזיכרון ואינם נשמרים אצלנו.',
            'נתונים טכניים: כתובת IP ומידע על הדפדפן או המכשיר מעובדים על ידי תשתית האירוח כדי לספק את השירות ולשמור על אבטחתו.',
          ],
        },
        {
          heading: 'עיבוד AI של צילומי מסך ודפים',
          body: [
            'כשאתם מעלים צילום מסך, מדביקים קישור או משתמשים בתוסף Chrome להוספת הזמנה, מוצר או עדכון מעקב, התמונה או הטקסט הנראה בדף נשלחים ל-API של Anthropic כדי שיקראו אותם. תוכן כזה עשוי לכלול פרטים אישיים שמופיעים בדף, כגון שם, כתובת, מספר טלפון ותוכן ההזמנה.',
            'התוצאה מוצגת לכם לבדיקה לפני השמירה. איננו שומרים את צילום המסך או טקסט הדף. AI עלול לטעות, ולכן יש לוודא את מה שנקרא.',
            'אנחנו משתמשים בעיבוד AI רק בהסכמתכם. אפשר לבטל אותה בכל עת בהגדרות ← פרטיות; התכונות המבוססות על AI יפסיקו לעבוד עד שתסכימו שוב.',
          ],
        },
        {
          heading: 'תוסף Chrome',
          body: [
            'התוסף קורא את הדף שאתם נמצאים בו רק כשלוחצים על פעולה בחלון שלו. הוא קורא טקסט נראה, נתוני מוצר מובנים וקישורי תמונות, ובדפי הזמנה ומעקב גם צילום של האזור הנראה; הוא אינו קורא שדות טפסים, עוגיות, סיסמאות או פרטי תשלום. בדפי הזמנה ומעקב כתובת האתר נשלחת ללא פרמטרי השאילתה.',
            'התוסף שומר את ההתחברות שלכם ל-SHUPIT מקומית בדפדפן ומשתמש בה רק כדי לתקשר עם SHUPIT. אפשר לנתק אותו בהגדרות.',
          ],
        },
        {
          heading: 'ספקי שירות',
          body: [
            'Google (Firebase Authentication ו-Cloud Firestore) מאחסנת נתוני חשבון ואפליקציה. מסד הנתונים שלנו ממוקם באזור ישראל (me-west1).',
            'Vercel מארחת את האתר וה-API (הפונקציות פועלות באזור פרנקפורט).',
            'Anthropic מעבדת צילומי מסך וטקסט דפים לצורך קריאת AI, לפי תנאיה ומדיניות השמירה שלה.',
            'שירות האייקונים של Google משמש להצגת אייקוני חנויות; נשלח אליו רק דומיין החנות.',
            'איננו מוכרים מידע אישי ואיננו משתמשים בו לפרסום.',
          ],
        },
        {
          heading: 'קישורי שותפים (Affiliate)',
          body: [
            'כשאתם פותחים חנות דרך SHUPIT ייתכן שנשתמש בקישור שותפים, אם פועלת תוכנית שותפים לאותה חנות. אנחנו רושמים את החנות, הזמן והאם נעשה שימוש בקישור שותפים. כתובת המוצר אינה נרשמת ביומן זה.',
          ],
        },
        {
          heading: 'כמה זמן אנחנו שומרים מידע',
          body: [
            'תוכן החשבון: עד שתמחקו אותו או את החשבון.',
            'רישומי קליקים של שותפים: עד 90 יום (ומנותקים מזהותכם אם תמחקו את החשבון).',
            'מוני שימוש יומיים: כ-35 יום. התראות שנקראו: כ-180 יום. מוני הגבלת קצב: דקות עד שעות.',
            'יומני אירוח ושגיאות כפופים להגדרות השמירה של ספק האירוח; היומנים שלנו נמנעים מתוכן אישי.',
          ],
        },
        {
          heading: 'הבחירות והזכויות שלכם',
          body: [
            'ייצוא: הגדרות ← פרטיות ← ייצוא הנתונים שלי מספק קובץ קריא-מכונה של המידע שיש לנו.',
            'מחיקה: הגדרות ← פרטיות ← מחיקת החשבון שלי מסירה לצמיתות את התוכן וההתחברות. חלק מהרישומים עשויים להישאר לזמן מוגבל כמתואר לעיל (רישומי קליקים מנותקי זהות) או בגיבויים וביומנים של ספקים עד שיפוגו.',
            `לכל בקשה אחרת (עיון, תיקון, התנגדות) פנו אל ${CONTACT}.`,
          ],
        },
        {
          heading: 'אבטחה',
          body: [
            'המידע מוצפן במעבר. הגישה לנתונים שלכם מוגבלת לחשבונכם באמצעות כללי אבטחה של מסד הנתונים והרשאות בצד השרת. אין מערכת מאובטחת לחלוטין; נשמח לשמוע על כל בעיה שתבחינו בה.',
          ],
        },
        {
          heading: 'קטינים',
          body: ['SHUPIT אינו מיועד למי שמתחת לגיל 16.'],
        },
        {
          heading: 'שינויים',
          body: [
            'אם המדיניות תשתנה באופן מהותי נעדכן את הגרסה לעיל ונבקש את הסכמתכם מחדש כשנדרש.',
          ],
        },
      ],
    },
  },
  terms: {
    en: {
      title: 'Terms of Service',
      updated: 'Version 2026-10-14',
      draft: 'Draft — not yet reviewed by a lawyer.',
      sections: [
        {
          heading: 'The service',
          body: [
            'SHUPIT helps you keep track of stores, saved products, orders and deliveries. It is a companion tool: it is not a store, it does not sell products, and it does not process payments. Purchases are made with the stores themselves, under their terms.',
          ],
        },
        {
          heading: 'Accuracy',
          body: [
            'Prices, availability, delivery statuses and dates shown in SHUPIT come from you, from pages and screenshots you provide, or from sources we label as such. They can be wrong or out of date. Items marked “not verified” have not been confirmed by a store or carrier. Always check with the store or carrier before relying on them.',
            'We do not monitor prices or shipments automatically unless a feature is clearly shown as active.',
          ],
        },
        {
          heading: 'AI features',
          body: [
            'AI reading of screenshots and pages is provided only with your consent and may make mistakes. You are responsible for checking the details before saving them.',
          ],
        },
        {
          heading: 'Your account and content',
          body: [
            'Keep your login secure. You are responsible for the content you add and must have the right to use any screenshots or pages you submit. Do not use SHUPIT to violate the law or the rights of others, to attack or overload the service, or to collect other people’s data.',
          ],
        },
        {
          heading: 'Third-party stores and affiliate links',
          body: [
            'Stores and carriers are independent of SHUPIT. Some links may be affiliate links, as described in the Affiliate disclosure. We do not guarantee that a purchase will be attributed to us or to any offer.',
          ],
        },
        {
          heading: 'Availability and changes',
          body: [
            'SHUPIT is provided “as is”, may change, and may be unavailable from time to time. We may update these terms; continuing to use SHUPIT after an update means you accept it.',
          ],
        },
        {
          heading: 'Liability',
          body: [
            'To the extent permitted by law, SHUPIT is not liable for losses arising from reliance on information shown in the app, from third-party stores or carriers, or from service interruptions. [Exact wording to be finalized by counsel.]',
          ],
        },
        {
          heading: 'Ending your use',
          body: [
            'You can stop using SHUPIT and delete your account at any time in Settings → Privacy.',
          ],
        },
        {
          heading: 'Governing law and contact',
          body: [
            `[Governing law and jurisdiction — to be completed.] Contact: ${CONTACT}.`,
          ],
        },
      ],
    },
    he: {
      title: 'תנאי שימוש',
      updated: 'גרסה 2026-10-14',
      draft: 'טיוטה — טרם נבדקה על ידי עורך דין.',
      sections: [
        {
          heading: 'השירות',
          body: [
            'SHUPIT עוזר לכם לעקוב אחר חנויות, מוצרים שמורים, הזמנות ומשלוחים. זהו כלי נלווה: אינו חנות, אינו מוכר מוצרים ואינו מעבד תשלומים. הרכישות מתבצעות מול החנויות עצמן, לפי תנאיהן.',
          ],
        },
        {
          heading: 'דיוק המידע',
          body: [
            'מחירים, זמינות, סטטוסי משלוח ותאריכים המוצגים ב-SHUPIT מגיעים מכם, מדפים וצילומי מסך שסיפקתם, או ממקורות שאנחנו מסמנים ככאלה. הם עלולים להיות שגויים או לא עדכניים. פריטים המסומנים "לא מאומת" לא אושרו על ידי חנות או חברת שילוח. יש לבדוק מול החנות או חברת השילוח לפני שנשענים עליהם.',
            'איננו עוקבים אחר מחירים או משלוחים באופן אוטומטי, אלא אם תכונה מוצגת בבירור כפעילה.',
          ],
        },
        {
          heading: 'תכונות AI',
          body: [
            'קריאת AI של צילומי מסך ודפים ניתנת רק בהסכמתכם ועלולה לטעות. באחריותכם לבדוק את הפרטים לפני השמירה.',
          ],
        },
        {
          heading: 'החשבון והתוכן שלכם',
          body: [
            'שמרו על אבטחת ההתחברות. אתם אחראים לתוכן שאתם מוסיפים, ועליכם להיות רשאים להשתמש בצילומים או בדפים שאתם שולחים. אין להשתמש ב-SHUPIT כדי להפר חוק או זכויות של אחרים, לתקוף או להעמיס על השירות, או לאסוף מידע של אנשים אחרים.',
          ],
        },
        {
          heading: 'חנויות צד שלישי וקישורי שותפים',
          body: [
            'חנויות וחברות שילוח אינן תלויות ב-SHUPIT. חלק מהקישורים עשויים להיות קישורי שותפים, כמתואר בגילוי הנאות. איננו מבטיחים שרכישה תיוחס לנו או להטבה כלשהי.',
          ],
        },
        {
          heading: 'זמינות ושינויים',
          body: [
            'SHUPIT ניתן "כמות שהוא", עשוי להשתנות ולא להיות זמין מדי פעם. ייתכן שנעדכן תנאים אלה; המשך השימוש לאחר עדכון משמעו הסכמה לו.',
          ],
        },
        {
          heading: 'אחריות',
          body: [
            'ככל שהדין מתיר, SHUPIT אינו אחראי להפסדים הנובעים מהישענות על מידע המוצג באפליקציה, מחנויות או חברות שילוח של צד שלישי, או מהפרעות בשירות. [הנוסח המדויק יסוכם על ידי יועץ משפטי.]',
          ],
        },
        {
          heading: 'סיום השימוש',
          body: ['אפשר להפסיק להשתמש ב-SHUPIT ולמחוק את החשבון בכל עת בהגדרות ← פרטיות.'],
        },
        {
          heading: 'דין חל ויצירת קשר',
          body: [`[הדין החל וסמכות השיפוט — יושלמו.] יצירת קשר: ${CONTACT}.`],
        },
      ],
    },
  },
  affiliate: {
    en: {
      title: 'Affiliate disclosure',
      updated: 'Version 2026-10-14',
      draft: 'Draft — not yet reviewed by a lawyer.',
      sections: [
        {
          heading: 'Current status',
          body: [
            'At this time no affiliate programme is active. Opening a store from SHUPIT takes you to the store’s own website and we earn nothing from it.',
          ],
        },
        {
          heading: 'When affiliate links are used',
          body: [
            'Where a store has an approved affiliate programme, some “Shop now” or “Buy at store” buttons may open the store through an affiliate link. If you buy, SHUPIT may earn a commission from the store. We will tell you when an affiliate link is used.',
          ],
        },
        {
          heading: 'What this does not change',
          body: [
            'Affiliate links do not change the price you pay. We do not promise deals, price alerts or cashback that are not actually available, and we cannot guarantee that a purchase will be tracked.',
          ],
        },
        {
          heading: 'Questions',
          body: [`Contact ${CONTACT}.`],
        },
      ],
    },
    he: {
      title: 'גילוי נאות — קישורי שותפים',
      updated: 'גרסה 2026-10-14',
      draft: 'טיוטה — טרם נבדקה על ידי עורך דין.',
      sections: [
        {
          heading: 'המצב כרגע',
          body: [
            'כרגע לא פעילה אף תוכנית שותפים. פתיחת חנות מתוך SHUPIT מובילה לאתר החנות עצמו, ואיננו מרוויחים מכך דבר.',
          ],
        },
        {
          heading: 'מתי נעשה שימוש בקישורי שותפים',
          body: [
            'כשלחנות יש תוכנית שותפים מאושרת, חלק מכפתורי "לחנות" או "לקנות בחנות" עשויים לפתוח את החנות דרך קישור שותפים. אם תרכשו, ייתכן ש-SHUPIT תקבל עמלה מהחנות. נציין בפניכם כשנעשה שימוש בקישור שותפים.',
          ],
        },
        {
          heading: 'מה זה לא משנה',
          body: [
            'קישורי שותפים אינם משנים את המחיר שאתם משלמים. איננו מבטיחים דילים, התראות מחיר או החזרים שאינם קיימים בפועל, ואיננו יכולים להבטיח שרכישה תיעקב.',
          ],
        },
        {
          heading: 'שאלות',
          body: [`פנו אל ${CONTACT}.`],
        },
      ],
    },
  },
};
