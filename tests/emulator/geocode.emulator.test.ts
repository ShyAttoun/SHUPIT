import { strict as assert } from 'node:assert';
import { after, before, beforeEach, describe, it } from 'node:test';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { geocodeAddress } from '../../api/_lib/geocode';

let app: App;
let db: Firestore;
before(() => {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  app = initializeApp({ projectId: 'demo-shupit' }, `geo-${Date.now()}`);
  db = getFirestore(app);
});
after(async () => deleteApp(app));

const t0 = new Date('2026-10-14T10:00:00Z');
const ok = (calls: { n: number }) =>
  (async (url: URL | string) => {
    calls.n++;
    assert.match(String(url), /nominatim\.openstreetmap\.org\/search/);
    return new Response(JSON.stringify([{ lat: '32.0853', lon: '34.7818' }]), { status: 200 });
  }) as unknown as typeof fetch;

describe('geocoding with cache', () => {
  beforeEach(async () => {
    const docs = await db.collection('geocodeCache').listDocuments();
    await Promise.all(docs.map((d) => d.delete()));
  });

  it('resolves once and then serves the cache', async () => {
    const calls = { n: 0 };
    const a = await geocodeAddress(db, 'Dizengoff 50, Tel Aviv', ok(calls), t0);
    const b = await geocodeAddress(db, '  dizengoff 50,  TEL AVIV', ok(calls), t0);
    assert.deepEqual(a, { lat: 32.0853, lng: 34.7818 });
    assert.deepEqual(b, a);
    assert.equal(calls.n, 1);
  });

  it('caches a miss for a while but retries later', async () => {
    const calls = { n: 0 };
    const none = (async () => {
      calls.n++;
      return new Response('[]', { status: 200 });
    }) as unknown as typeof fetch;
    assert.equal(await geocodeAddress(db, 'Nowhere 99999', none, t0), null);
    assert.equal(await geocodeAddress(db, 'Nowhere 99999', none, new Date(t0.getTime() + 3600_000)), null);
    assert.equal(calls.n, 1);
    await geocodeAddress(db, 'Nowhere 99999', none, new Date(t0.getTime() + 8 * 86_400_000));
    assert.equal(calls.n, 2);
  });

  it('does not cache transient failures', async () => {
    const calls = { n: 0 };
    const fail = (async () => {
      calls.n++;
      return new Response('busy', { status: 503 });
    }) as unknown as typeof fetch;
    assert.equal(await geocodeAddress(db, 'Herzl 1 Haifa', fail, t0), null);
    assert.equal(await geocodeAddress(db, 'Herzl 1 Haifa', ok(calls), t0) !== null, true);
  });

  it('ignores addresses that are too short to be meaningful', async () => {
    const calls = { n: 0 };
    assert.equal(await geocodeAddress(db, ' a ', ok(calls), t0), null);
    assert.equal(calls.n, 0);
  });
});
