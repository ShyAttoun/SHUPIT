import { json } from './_lib/http';
import { withAuth } from './_lib/withAuth';

export const GET = withAuth((_request, user) =>
  json({ uid: user.uid, email: user.email ?? null }),
);
