import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  type Firestore,
} from 'firebase/firestore';
import { firebaseConfig, useEmulators } from './env';

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

function createDb(): Firestore {
  try {
    // Optional fields are `undefined` in app code; Firestore rejects those by default.
    return initializeFirestore(app, { ignoreUndefinedProperties: true });
  } catch {
    // Fast refresh: already initialized.
    return getFirestore(app);
  }
}

export const db = createDb();

let emulatorsConnected = false;
export function connectEmulatorsOnce(connectAuth: () => void) {
  if (!useEmulators || emulatorsConnected) return;
  emulatorsConnected = true;
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectAuth();
}
