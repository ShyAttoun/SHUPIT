import { adminAuth, adminDb } from '../_lib/firebaseAdmin';
import { exportAccountData } from '../_lib/account';
import { preflight } from '../_lib/http';
import { EXPORT_RULE } from '../_lib/rateLimit';
import { withAuth } from '../_lib/withAuth';

export const OPTIONS = preflight;

/** GET → a complete, machine-readable export of the caller's data (JSON download). */
export const GET = withAuth(
  async (request, user) => {
    const record = await adminAuth().getUser(user.uid);
    const data = await exportAccountData(adminDb(), user.uid, {
      email: record.email ?? null,
      createdAt: record.metadata.creationTime ? new Date(record.metadata.creationTime).toISOString() : null,
    });
    return new Response(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="shupit-export-${new Date().toISOString().slice(0, 10)}.json"`,
        'cache-control': 'no-store',
        ...(request.headers.get('origin') ? { 'access-control-allow-origin': request.headers.get('origin')! } : {}),
      },
    });
  },
  { rate: EXPORT_RULE },
);
