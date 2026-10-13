import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { app, connectEmulatorsOnce } from './firebase';

export const auth = getAuth(app);

connectEmulatorsOnce(() =>
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true }),
);
