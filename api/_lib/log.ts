import { createHash } from 'node:crypto';

/** Keys whose values are never logged. */
const SENSITIVE_KEY =
  /authorization|token|password|passwd|secret|cookie|session|email|phone|address|apikey|api_key|private|credential|code$|imagebase64|^text$|^body$|screenshot|keys?$/i;

const EMAIL = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const BEARER = /bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const LONG_SECRET = /\b[A-Za-z0-9_-]{40,}\b/g;
const URL_WITH_QUERY = /(https?:\/\/[^\s?#"']+)\?[^\s"']*/gi;

/** Redacts personal data and credentials from a free-text string. */
export function redactString(s: string): string {
  return s
    .replace(BEARER, 'Bearer [redacted]')
    .replace(JWT, '[redacted-jwt]')
    .replace(EMAIL, '$1***@$2')
    .replace(URL_WITH_QUERY, '$1?[redacted]')
    .replace(LONG_SECRET, '[redacted]')
    .slice(0, 2000);
}

/** Deep, bounded redaction for structured log fields. */
export function redact(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (depth >= 4) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
      out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : redact(v, depth + 1);
    }
    return out;
  }
  return String(value).slice(0, 200);
}

/** Stable, non-reversible short id so a user's events can be correlated without storing the uid. */
export const hashId = (id: string): string => createHash('sha256').update(id).digest('hex').slice(0, 10);

type Level = 'info' | 'warn' | 'error';

/** One JSON line per event; safe to ship to any log sink. */
export function log(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...(redact(fields) as Record<string, unknown>),
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

/** Error → loggable fields: class name and a redacted message, never the stack with user data. */
export function errorFields(e: unknown): { errorName: string; errorMessage: string } {
  return e instanceof Error
    ? { errorName: e.name, errorMessage: redactString(e.message) }
    : { errorName: 'NonError', errorMessage: redactString(String(e)) };
}
