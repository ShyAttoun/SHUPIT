import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import { resolve } from 'node:path';

let env: RulesTestEnvironment;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'shupit-rules-test',
    firestore: {
      rules: readFileSync(resolve(__dirname, '../../../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});
after(async () => env.cleanup());
beforeEach(async () => env.clearFirestore());

const alice = () => env.authenticatedContext('alice').firestore();
const bob = () => env.authenticatedContext('bob').firestore();
const anon = () => env.unauthenticatedContext().firestore();

describe('user-owned data', () => {
  it('owner can write and read own saved product', async () => {
    const ref = doc(alice(), 'users/alice/savedProducts/p1');
    await assertSucceeds(setDoc(ref, { title: 'Lamp', collectionIds: [] }));
    await assertSucceeds(getDoc(ref));
  });

  it('other users and anonymous cannot read or write', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/alice/savedProducts/p1'), { title: 'Lamp' });
    });
    await assertFails(getDoc(doc(bob(), 'users/alice/savedProducts/p1')));
    await assertFails(setDoc(doc(bob(), 'users/alice/savedProducts/p2'), { title: 'x' }));
    await assertFails(getDoc(doc(anon(), 'users/alice/savedProducts/p1')));
  });

  it('client cannot write shipments or tracking events', async () => {
    await assertFails(setDoc(doc(alice(), 'users/alice/shipments/s1'), { status: 'delivered' }));
    await assertFails(
      setDoc(doc(alice(), 'users/alice/shipments/s1/trackingEvents/e1'), { status: 'delivered' }),
    );
  });

  it('client may only mark a notification read', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/alice/notifications/n1'), {
        type: 'delivered',
        readAt: null,
      });
    });
    const ref = doc(alice(), 'users/alice/notifications/n1');
    await assertSucceeds(updateDoc(ref, { readAt: 'now' }));
    await assertFails(updateDoc(ref, { type: 'price_drop' }));
  });
});

describe('price watch', () => {
  it('owner can subscribe, but not for another uid', async () => {
    await assertSucceeds(
      setDoc(doc(alice(), 'priceWatchSubscriptions/s1'), { uid: 'alice', enabled: true }),
    );
    await assertFails(
      setDoc(doc(alice(), 'priceWatchSubscriptions/s2'), { uid: 'bob', enabled: true }),
    );
  });

  it('subscription is private to its owner', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'priceWatchSubscriptions/s1'), { uid: 'alice' });
    });
    await assertSucceeds(getDoc(doc(alice(), 'priceWatchSubscriptions/s1')));
    await assertFails(getDoc(doc(bob(), 'priceWatchSubscriptions/s1')));
  });

  it('clients cannot touch observations, alert events, or provider config', async () => {
    await assertFails(setDoc(doc(alice(), 'priceObservations/o1'), { price: 1 }));
    await assertFails(getDoc(doc(alice(), 'priceObservations/o1')));
    await assertFails(setDoc(doc(alice(), 'priceAlertEvents/a1'), { uid: 'alice' }));
    await assertFails(getDoc(doc(alice(), 'merchantPriceProviders/p1')));
    await assertFails(getDoc(doc(alice(), 'affiliateClicks/c1')));
  });
});

describe('merchants', () => {
  it('signed-in users can read but not write', async () => {
    await assertSucceeds(getDoc(doc(alice(), 'merchants/m1')));
    await assertFails(setDoc(doc(alice(), 'merchants/m1'), { name: 'x' }));
    await assertFails(getDoc(doc(anon(), 'merchants/m1')));
  });
});
