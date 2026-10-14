import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

/** Endpoints that are intentionally not behind a user session. */
const PUBLIC = new Set(['health.ts']);
/** Cron endpoints authenticate with a shared secret instead of a user token. */
const CRON_DIR = 'cron';

function handlers(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('_')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...handlers(p));
    else if (name.endsWith('.ts')) out.push(p);
  }
  return out;
}

test('every user-facing API endpoint is wrapped in withAuth', () => {
  const files = handlers('api');
  assert.ok(files.length > 10);
  for (const f of files) {
    const base = f.split('/').pop()!;
    if (PUBLIC.has(base) || f.includes(`/${CRON_DIR}/`) || f.endsWith('tsconfig.json')) continue;
    // Phone automations authenticate with a personal key (hash lookup) instead of a Firebase token.
    if (base === 'sms-hook.ts') {
      const hook = readFileSync(f, 'utf8');
      assert.match(hook, /uidForKey\(/, 'sms-hook must resolve the user from a personal key');
      assert.match(hook, /401/, 'sms-hook must reject unknown keys');
      continue;
    }
    const src = readFileSync(f, 'utf8');
    const exported = [...src.matchAll(/export (?:const|function|async function) (GET|POST|DELETE|PUT|PATCH)\b/g)].map((m) => m[1]);
    for (const method of exported) {
      assert.match(
        src,
        new RegExp(`export const ${method} = withAuth\\(`),
        `${f}: ${method} must be exported as withAuth(...)`,
      );
    }
  }
});

test('cron endpoints verify CRON_SECRET', () => {
  for (const f of handlers('api').filter((p) => p.includes(`/${CRON_DIR}/`))) {
    const src = readFileSync(f, 'utf8');
    assert.match(src, /CRON_SECRET/, `${f} must check CRON_SECRET`);
  }
});

test('user-scoped data access never takes a uid from the request', () => {
  for (const f of handlers('api').filter((p) => !p.includes('/cron/'))) {
    const src = readFileSync(f, 'utf8');
    // uid must come from the verified token (`user.uid`), not from query/body.
    assert.doesNotMatch(src, /searchParams\.get\(['"]uid['"]\)/, `${f} reads uid from the query`);
    assert.doesNotMatch(src, /body\.uid|parsed\.data\.uid/, `${f} reads uid from the body`);
  }
});
