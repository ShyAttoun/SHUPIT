const ALLOWED_ORIGINS = new Set([
  'https://shupit.vercel.app',
  'https://app.shupit.co.il',
  'http://localhost:8081',
  'http://localhost:19006',
]);

function corsHeaders(request?: Request): Record<string, string> {
  const origin = request?.headers.get('origin');
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    vary: 'Origin',
  };
}

export function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
  request?: Request,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...corsHeaders(request),
      ...headers,
    },
  });
}

export function errorResponse(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status);
}

export function preflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

/** Extracts the token from "Authorization: Bearer <token>", or null. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

export async function readJson(request: Request, maxBytes = 64_000): Promise<unknown> {
  const text = await request.text();
  if (text.length > maxBytes) throw new Error('payload too large');
  return JSON.parse(text);
}
