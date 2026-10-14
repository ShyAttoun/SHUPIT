import { errorResponse, preflight } from './_lib/http';
import { UnsafeUrlError, assertPublicHttpUrl } from './_lib/ssrf';
import { withAuth } from './_lib/withAuth';

export const OPTIONS = preflight;

const MAX_BYTES = 3_000_000;
const MAX_REDIRECTS = 3;

/**
 * GET ?u=<image url> → the image bytes, fetched server-side without a Referer.
 * Used only as a fallback when a store's CDN refuses to show its picture inside our app (hotlink
 * protection). Signed-in users only; public hosts only; images only (no SVG); size-capped.
 */
export const GET = withAuth(
  async (request) => {
    const raw = new URL(request.url).searchParams.get('u');
    if (!raw || raw.length > 2048) return errorResponse(400, 'bad_request', 'Missing image url');

    let target = raw;
    try {
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const url = await assertPublicHttpUrl(target);
        const res = await fetch(url, {
          redirect: 'manual',
          signal: AbortSignal.timeout(7000),
          headers: {
            accept: 'image/avif,image/webp,image/*;q=0.8',
            'user-agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          },
        });
        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get('location');
          if (!loc) break;
          target = new URL(loc, url).toString();
          continue;
        }
        if (!res.ok) return errorResponse(502, 'upstream', 'Image unavailable');
        const type = (res.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
        if (!type.startsWith('image/') || type === 'image/svg+xml') {
          return errorResponse(415, 'not_image', 'Not an image');
        }
        const declared = Number(res.headers.get('content-length') ?? 0);
        if (declared > MAX_BYTES) return errorResponse(413, 'too_large', 'Image too large');
        const buf = new Uint8Array(await res.arrayBuffer());
        if (buf.byteLength > MAX_BYTES) return errorResponse(413, 'too_large', 'Image too large');
        return new Response(buf, {
          status: 200,
          headers: {
            'content-type': type,
            'cache-control': 'private, max-age=86400',
            'x-content-type-options': 'nosniff',
          },
        });
      }
      return errorResponse(502, 'upstream', 'Too many redirects');
    } catch (e) {
      if (e instanceof UnsafeUrlError) return errorResponse(400, 'unsafe_url', 'URL not allowed');
      return errorResponse(502, 'upstream', 'Image unavailable');
    }
  },
  { rate: { bucket: 'img', limit: 90, windowSec: 60 } },
);
