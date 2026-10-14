import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { en } from './locales/en';
import { he } from './locales/he';

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|ts)$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });

const lookup = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);

// Plural keys are stored as key_one / key_other.
const exists = (obj: unknown, key: string) =>
  typeof lookup(obj, key) === 'string' || typeof lookup(obj, `${key}_other`) === 'string';

describe('translation keys used in code exist in both languages', () => {
  const root = join(__dirname, '..', '..');
  const files = [...walk(join(root, 'src')), ...walk(join(root, 'app'))];
  const used = new Map<string, string>();
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z][\w]*(?:\.[\w]+)+)'/g)) used.set(m[1]!, f);
  }

  it('finds keys to check', () => {
    expect(used.size).toBeGreaterThan(50);
  });

  it('every literal key resolves in English and Hebrew', () => {
    const missing = [...used.entries()].filter(([k]) => !exists(en, k) || !exists(he, k)).map(([k, f]) => `${k}  (${f.split('/src/')[1] ?? f})`);
    expect(missing).toEqual([]);
  });
});
