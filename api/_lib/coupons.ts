export interface CouponCandidate {
  code: string;
  description?: string | null;
  expiresAt?: string | null;
}

const CODE = /^[A-Za-z0-9][A-Za-z0-9_-]{2,39}$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Keeps only plausible codes. When the source was text (page or pasted), the code must literally
 * appear in it, so a model can never introduce a code that is not there. Images cannot be checked
 * this way, so for them only the shape is enforced and the user confirms before saving.
 */
export function sanitizeCoupons(
  list: CouponCandidate[],
  sourceText: string | null,
): { code: string; description?: string; expiresAt?: string }[] {
  const hay = sourceText?.toLowerCase() ?? null;
  const seen = new Set<string>();
  const out: { code: string; description?: string; expiresAt?: string }[] = [];
  for (const c of list) {
    const code = c.code.trim().toUpperCase();
    if (!CODE.test(code) || seen.has(code)) continue;
    if (hay !== null && !hay.includes(code.toLowerCase())) continue;
    seen.add(code);
    const exp = c.expiresAt && YMD.test(c.expiresAt) && !Number.isNaN(Date.parse(c.expiresAt)) ? c.expiresAt : undefined;
    out.push({
      code,
      ...(c.description ? { description: c.description.trim().slice(0, 200) } : {}),
      ...(exp ? { expiresAt: exp } : {}),
    });
  }
  return out.slice(0, 20);
}
