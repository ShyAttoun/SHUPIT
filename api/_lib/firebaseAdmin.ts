import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Service-account credentials come from FIREBASE_SERVICE_ACCOUNT_BASE64
 * (base64 of the service-account JSON). Never commit or log them.
 */
function loadApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!encoded) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 is not configured');
  }
  const json = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as {
    project_id: string;
    client_email: string;
    private_key: string;
  };
  return initializeApp({
    credential: cert({
      projectId: json.project_id,
      clientEmail: json.client_email,
      privateKey: json.private_key,
    }),
  });
}

export const adminAuth = () => getAuth(loadApp());
export const adminDb = () => getFirestore(loadApp());
