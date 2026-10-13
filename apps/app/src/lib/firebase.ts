import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { firebaseConfig, useEmulators } from './env';

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);

let emulatorsConnected = false;
export function connectEmulatorsOnce(connectAuth: () => void) {
  if (!useEmulators || emulatorsConnected) return;
  emulatorsConnected = true;
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectAuth();
}
