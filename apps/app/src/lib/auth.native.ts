import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  connectAuthEmulator,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
import { app, connectEmulatorsOnce } from './firebase';

function createAuth() {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Fast refresh: auth was already initialized.
    return getAuth(app);
  }
}

export const auth = createAuth();

connectEmulatorsOnce(() =>
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true }),
);
