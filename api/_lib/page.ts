import type { PageCapture } from '@shupit/contracts';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Rebuilds a minimal HTML document from what the extension captured so the same
 * deterministic parser (JSON-LD / Open Graph) used for server-fetched pages can run on it.
 */
export function htmlFromCapture(page: PageCapture): string {
  const parts: string[] = [];
  if (page.title) parts.push(`<title>${esc(page.title)}</title>`);
  for (const [k, v] of Object.entries(page.metas ?? {})) {
    parts.push(`<meta property="${esc(k)}" name="${esc(k)}" content="${esc(v)}">`);
  }
  for (const ld of page.jsonLd ?? []) {
    parts.push(`<script type="application/ld+json">${ld.replace(/<\//g, '<\\/')}</script>`);
  }
  return `<html><head>${parts.join('')}</head><body></body></html>`;
}
