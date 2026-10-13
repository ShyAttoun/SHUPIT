import { json } from './_lib/http';

export function GET(): Response {
  return json({ ok: true, service: 'shupit-api', time: new Date().toISOString() });
}
