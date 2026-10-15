/** Public values only. The Firebase web API key is an identifier, not a secret. */
export const APP_URL = 'https://app.shupit.co.il';
export const API_BASE = APP_URL;
export const FIREBASE_API_KEY = 'AIzaSyCQRoycZDqB-7sSTeTa9H-VilgfhJl_GzM';

declare const __DEV__: boolean;

/**
 * Origins allowed to hand a session to the extension. Must match manifest externally_connectable.
 * localhost is included only in development builds (`node build.mjs --dev`).
 */
export const ALLOWED_ORIGINS = ['https://app.shupit.co.il', 'https://shupit.vercel.app', ...(__DEV__ ? ['http://localhost:8081'] : [])];
