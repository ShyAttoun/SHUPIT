export interface PageCapture {
  url: string;
  title?: string;
  metas?: Record<string, string>;
  jsonLd?: string[];
  text?: string;
}

/**
 * Injected into the active tab ONLY after the user clicks an action in the popup
 * (activeTab permission). It must be self-contained: no imports or outer scope.
 * Reads what is on the page; never touches form fields, cookies or storage.
 */
export function readPage(): PageCapture {
  const metas: Record<string, string> = {};
  document.querySelectorAll('meta[property],meta[name],meta[itemprop]').forEach((m) => {
    if (Object.keys(metas).length >= 60) return;
    const k = m.getAttribute('property') || m.getAttribute('name') || m.getAttribute('itemprop');
    const v = m.getAttribute('content');
    if (k && v && !(k in metas)) metas[k.slice(0, 100)] = v.slice(0, 1000);
  });
  const jsonLd = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    .map((s) => (s.textContent ?? '').slice(0, 50_000))
    .filter(Boolean)
    .slice(0, 5);
  const text = (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 30_000);
  return { url: location.href, title: document.title.slice(0, 500), metas, jsonLd, text };
}

/** Order/tracking pages: drop query and hash, which often carry personal tokens. */
export function withoutQuery(page: PageCapture): PageCapture {
  try {
    const u = new URL(page.url);
    return { ...page, url: `${u.origin}${u.pathname}` };
  } catch {
    return page;
  }
}
