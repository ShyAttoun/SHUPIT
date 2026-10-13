import { json, preflight } from './_lib/http';
import { withAuth } from './_lib/withAuth';

export const OPTIONS = preflight;

export const GET = withAuth((request, user) =>
  json({ uid: user.uid, email: user.email ?? null }, 200, {}, request),
);
