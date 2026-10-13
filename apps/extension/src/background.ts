import { clearSession, getSession, jwtExpiryMs, setSession } from './auth';
import { ALLOWED_ORIGINS } from './config';

interface ConnectMessage {
  type: 'connect';
  uid: string;
  email: string | null;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * The SHUPIT web app hands over the signed-in user's session (any sign-in method).
 * Only messages from allow-listed origins are accepted.
 */
chrome.runtime.onMessageExternal.addListener((msg: unknown, sender, sendResponse) => {
  const origin = sender.origin ?? (sender.url ? new URL(sender.url).origin : '');
  if (!ALLOWED_ORIGINS.includes(origin)) {
    sendResponse({ ok: false, error: 'origin_not_allowed' });
    return;
  }
  const m = msg as Partial<ConnectMessage> & { type?: string };

  if (m.type === 'connect') {
    if (!m.uid || !m.idToken || !m.refreshToken) {
      sendResponse({ ok: false, error: 'invalid_message' });
      return;
    }
    void setSession({
      uid: m.uid,
      email: m.email ?? null,
      idToken: m.idToken,
      refreshToken: m.refreshToken,
      expiresAt: jwtExpiryMs(m.idToken) ?? Date.now() + (m.expiresIn ?? 3600) * 1000,
    }).then(() => sendResponse({ ok: true }));
    return true; // async response
  }
  if (m.type === 'disconnect') {
    void clearSession().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (m.type === 'ping') {
    void getSession().then((s) => sendResponse({ ok: true, connected: !!s, version: chrome.runtime.getManifest().version }));
    return true;
  }
  sendResponse({ ok: false, error: 'unknown_message' });
  return;
});
