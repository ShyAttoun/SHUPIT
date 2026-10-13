import { ApiError, api, clearSession, getSession, jwtExpiryMs, setSession } from './auth';
import { readPage, visibleScreenshot, withoutQuery, type PageCapture } from './capture';
import { ALLOWED_ORIGINS } from './config';
import { JOB_KEY, type BgRequest, type BgResponse, type Job } from './job';

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
    return true;
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

// ------------------------------------------------------------------ jobs
// Work runs here, not in the popup: a popup is destroyed the moment it loses focus,
// which would cancel an in-flight request.

async function setJob(job: Job | null) {
  if (job) await chrome.storage.local.set({ [JOB_KEY]: job });
  else await chrome.storage.local.remove(JOB_KEY);
}

function badge(text: string, color = '#00B8B0') {
  void chrome.action.setBadgeText({ text });
  void chrome.action.setBadgeBackgroundColor({ color });
}

function errorCode(e: unknown): string {
  if (e instanceof ApiError) return e.status === 401 ? 'disconnected' : e.code;
  return 'generic';
}

async function runJob(req: Extract<BgRequest, { type: 'start' }>) {
  const job: Job = {
    id: crypto.randomUUID(),
    kind: req.kind,
    status: 'running',
    startedAt: Date.now(),
    shipmentId: req.shipmentId,
  };
  await setJob(job);
  badge('…', '#64748B');

  try {
    // Grab the screenshot first, while the tab is certainly still in view.
    const screenshot = req.kind === 'product' ? null : await visibleScreenshot(req.windowId);
    const [res] = await chrome.scripting.executeScript({ target: { tabId: req.tabId }, func: readPage });
    const raw = res?.result as PageCapture | undefined;
    if (!raw) throw new Error('unsupported');
    job.pageUrl = raw.url;

    if (req.kind === 'product') {
      const r = await api<{ data: Job['product'] }>('/api/capture', {
        method: 'POST',
        body: { kind: 'product', page: raw },
      });
      job.product = r.data;
    } else if (req.kind === 'orders') {
      const r = await api<{ orders?: Job['orders']; data?: NonNullable<Job['orders']>[number]['data']; merchantId?: string | null }>(
        '/api/capture',
        { method: 'POST', body: { kind: 'order', page: withoutQuery(raw), ...(screenshot ? { screenshot } : {}) } },
      );
      job.orders = r.orders ?? (r.data ? [{ data: r.data, merchantId: r.merchantId ?? null }] : []);
    } else {
      const r = await api<NonNullable<Job['result']>>(
        `/api/shipments-status?id=${encodeURIComponent(req.shipmentId ?? '')}`,
        { method: 'POST', body: { kind: 'order', page: withoutQuery(raw), ...(screenshot ? { screenshot } : {}) } },
      );
      job.result = r;
    }
    job.status = 'ready';
    badge('✓');
  } catch (e) {
    job.status = 'error';
    job.error = e instanceof Error && e.message === 'unsupported' ? 'unsupported' : errorCode(e);
    badge('!', '#D92D20');
  }
  await setJob(job);
}

chrome.runtime.onMessage.addListener((msg: BgRequest, _sender, sendResponse: (r: BgResponse) => void) => {
  if (msg.type === 'start') {
    void runJob(msg);
    sendResponse({ ok: true });
    return;
  }
  if (msg.type === 'clear-job') {
    void setJob(null).then(() => {
      badge('');
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg.type === 'api') {
    void api(msg.path, { method: msg.method, body: msg.body })
      .then((data) => sendResponse({ ok: true, data }))
      .catch((e: unknown) =>
        sendResponse(
          e instanceof ApiError
            ? { ok: false, status: e.status, code: e.code, body: e.body }
            : { ok: false, status: 0, code: 'generic' },
        ),
      );
    return true;
  }
  return;
});
