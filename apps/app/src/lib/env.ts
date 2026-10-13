import { z } from 'zod';

const schema = z.object({
  apiKey: z.string().min(1),
  authDomain: z.string().min(1),
  projectId: z.string().min(1),
  storageBucket: z.string().min(1),
  messagingSenderId: z.string().min(1),
  appId: z.string().min(1),
});

// Expo only inlines EXPO_PUBLIC_* when accessed statically.
const parsed = schema.safeParse({
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
});

if (!parsed.success) {
  throw new Error(
    'Missing Firebase configuration. Copy apps/app/.env.example to apps/app/.env and fill it in.',
  );
}

export const firebaseConfig = parsed.data;
export const useEmulators = process.env.EXPO_PUBLIC_USE_EMULATORS === 'true';
