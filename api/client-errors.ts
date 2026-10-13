import { z } from 'zod';
import { adminDb } from './_lib/firebaseAdmin';
import { errorResponse, json, preflight, readJson } from './_lib/http';
import { hashId, log, redactString } from './_lib/log';
import { withAuth } from './_lib/withAuth';

export const OPTIONS = preflight;

const body = z.object({
  kind: z.enum(['error', 'unhandledrejection', 'boundary']),
  message: z.string().max(1000),
  stack: z.string().max(6000).optional(),
  /** Path only (never the query string). */
  path: z.string().max(300).optional(),
  appVersion: z.string().max(40).optional(),
  language: z.string().max(10).optional(),
  userAgent: z.string().max(300).optional(),
});

/**
 * POST → client-side error report. Stored (redacted) in a server-only collection for review and
 * purged after 30 days. The uid is stored only as a short hash.
 */
export const POST = withAuth(
  async (request, user) => {
    const parsed = body.safeParse(await readJson(request, 16_000));
    if (!parsed.success) return errorResponse(400, 'validation', 'Invalid report');
    const d = parsed.data;
    const doc = {
      kind: d.kind,
      message: redactString(d.message),
      stack: d.stack ? redactString(d.stack) : null,
      path: d.path?.split('?')[0] ?? null,
      appVersion: d.appVersion ?? null,
      language: d.language ?? null,
      userAgent: d.userAgent ? redactString(d.userAgent) : null,
      uidHash: hashId(user.uid),
      createdAt: new Date().toISOString(),
    };
    await adminDb().collection('errorReports').add(doc);
    log('warn', 'client_error', { kind: d.kind, message: doc.message, path: doc.path });
    return json({ ok: true }, 202, {}, request);
  },
  { rate: { bucket: 'client-errors', limit: 20, windowSec: 60 } },
);
