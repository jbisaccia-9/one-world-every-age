import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FamilyBudgetStore } from '../apps/api/src/family-budget.js';
import {
  familyBudgetRequestSchema, familyBudgetTransitionSchema, familyBudgetSnapshotSchema,
  familyBudgetPurchaseSchema,
} from '@beacon/contracts/family-budget';

const owner = 'synthetic-family-a', other = 'synthetic-family-b';
const request = (store: FamilyBudgetStore, key: string, itemId = 'family-wallet-four', ownerId = owner) => store.request(ownerId, { itemId, idempotencyKey: key });

test('sample public contracts reject client prices, policy, ownership, approval and completion provenance', () => {
  const valid = { itemId: 'spark-coins-100', idempotencyKey: 'sample-request' };
  assert.equal(familyBudgetRequestSchema.safeParse(valid).success, true);
  for (const extra of [{ amountMinor: 1 }, { quantity: 1 }, { productPath: 'spark-coins-100' }, { currency: 'EUR' }, { ownerId: other }, { mode: 'local-demo' }, { source: 'verified-provider' }, { approved: true }, { parentApproval: 'verified' }, { monthlyMinor: 100000 }]) {
    assert.equal(familyBudgetRequestSchema.safeParse({ ...valid, ...extra }).success, false);
  }
  assert.equal(familyBudgetRequestSchema.safeParse({ ...valid, itemId: 'external-game-currency' }).success, false);
  assert.equal(familyBudgetTransitionSchema.safeParse({ outcome: 'completed' }).success, true);
  for (const extra of [{ source: 'verified-provider' }, { paid: true }, { parentApproval: true }]) {
    assert.equal(familyBudgetTransitionSchema.safeParse({ outcome: 'completed', ...extra }).success, false);
  }
  assert.equal(familyBudgetTransitionSchema.safeParse({ outcome: 'expired' }).success, false);
});

test('server sample carts mirror checked owned catalog prices and block the $54.95 cart and scam', t => {
  const store = new FamilyBudgetStore(); t.after(() => store.close());
  const snapshot = store.snapshot(owner);
  assert.deepEqual(snapshot.policy, {
    perPurchaseMinor: 5000, monthlyMinor: 25000, currency: 'USD', timezone: 'UTC', source: 'local-sample',
    parentLink: 'unverified', parentApproval: 'unverified', realPurchases: 'blocked', notice: snapshot.policy.notice,
  });
  assert.match(snapshot.policy.notice, /not a verified parent policy/);
  assert.equal(snapshot.spentMinor, 0); assert.equal(snapshot.reservedMinor, 0); assert.equal(snapshot.availableMinor, 25000);
  assert.deepEqual(snapshot.catalog.map(item => [item.id, item.amountMinor]), [
    ['ozone-layer-family-wallet', 1099], ['spark-coins-100', 99], ['family-wallet-four', 4396], ['family-wallet-five', 5495], ['verification-pack', 100],
  ]);
  assert.deepEqual(snapshot.catalog.filter(item => item.kind === 'sample').map(item => [item.productPath, item.quantity, item.priceCheckedAt]), [
    ['ozone-layer-family-wallet', 1, '2026-10-21'], ['spark-coins-100', 1, '2026-10-21'],
    ['ozone-layer-family-wallet', 4, '2026-10-21'], ['ozone-layer-family-wallet', 5, '2026-10-21'],
  ]);
  assert.match(snapshot.notice, /read-only owned FastSpring test catalog lookup/);
  assert.match(snapshot.notice, /Billing and saved-method support remain unverified/);
  assert.equal(request(store, 'under-purchase-limit').purchase.state, 'pending');
  assert.equal(request(store, 'too-large', 'family-wallet-five').purchase.state, 'blocked');
  const scam = request(store, 'risky', 'verification-pack');
  assert.equal(scam.purchase.state, 'blocked'); assert.match(scam.purchase.reason, /Scam example/);
  assert.equal(scam.snapshot.reservedMinor, 4396); assert.equal(scam.snapshot.availableMinor, 20604);
  for (const purchase of scam.snapshot.requests) {
    assert.equal(purchase.paid, false); assert.equal(purchase.fulfilled, false);
    assert.equal(purchase.checkoutCalls, 0); assert.equal(purchase.chargeCalls, 0);
    assert.equal(purchase.simulated, true);
    assert.equal(familyBudgetPurchaseSchema.safeParse({ ...purchase, paid: true }).success, false);
  }
  assert.equal(familyBudgetSnapshotSchema.safeParse({ ...snapshot, spentMinor: 0.5 }).success, false);
  // Returned data cannot change the authoritative policy or catalog.
  snapshot.catalog[0].amountMinor = 1;
  assert.equal(request(store, 'coins', 'spark-coins-100').purchase.amountMinor, 99);
});

test('pending reservations enforce the monthly cap, release on failure/cancellation and spend exactly once', t => {
  const store = new FamilyBudgetStore(); t.after(() => store.close());
  const pending = Array.from({ length: 5 }, (_, i) => request(store, `pending-${i}`).purchase);
  assert.equal(store.snapshot(owner).reservedMinor, 21980);
  const denied = request(store, 'at-cap');
  assert.equal(denied.purchase.state, 'blocked'); assert.equal(denied.snapshot.availableMinor, 3020);
  assert.match(denied.purchase.reason, /including pending/);
  const complete = store.transition(owner, pending[0].id, 'completed', 'local-demo');
  assert.equal(complete.snapshot.spentMinor, 4396); assert.equal(complete.snapshot.reservedMinor, 17584);
  for (let i = 0; i < 3; i++) {
    const duplicate = store.transition(owner, pending[0].id, 'completed', 'local-demo');
    assert.equal(duplicate.snapshot.spentMinor, 4396); assert.equal(duplicate.snapshot.availableMinor, 3020);
    assert.equal(duplicate.purchase.paid, false); assert.equal(duplicate.purchase.fulfilled, false);
  }
  assert.equal(request(store, 'completed-still-counts').purchase.state, 'blocked');
  store.transition(owner, pending[1].id, 'failed', 'local-demo');
  store.transition(owner, pending[2].id, 'cancelled', 'local-demo');
  assert.equal(store.snapshot(owner).availableMinor, 11812);
  assert.equal(request(store, 'after-release').purchase.state, 'pending');
  // A denied idempotent request does not silently become authorized after release.
  assert.deepEqual(request(store, 'at-cap').purchase, denied.purchase);
  for (const previous of [pending[1], pending[2]]) {
    assert.throws(() => store.transition(owner, previous.id, 'completed', 'local-demo'), { code: 'CONFLICT' });
  }
  assert.throws(() => store.transition(owner, pending[0].id, 'cancelled', 'local-demo'), { code: 'CONFLICT' });
  assert.equal(store.snapshot(owner).spentMinor + store.snapshot(owner).reservedMinor, 17584);
});

test('five completed four-wallet sample carts count toward the UTC monthly limit and block a sixth', t => {
  const store = new FamilyBudgetStore(); t.after(() => store.close());
  for (let i = 0; i < 5; i++) {
    const pending = request(store, `completed-cart-${i}`);
    assert.equal(pending.purchase.state, 'pending');
    const completed = store.transition(owner, pending.purchase.id, 'completed', 'local-demo');
    assert.equal(completed.snapshot.spentMinor, (i + 1) * 4396);
    assert.equal(completed.snapshot.reservedMinor, 0);
    assert.equal(completed.purchase.paid, false); assert.equal(completed.purchase.fulfilled, false);
  }
  const sixth = request(store, 'sixth-completed-cart');
  assert.equal(sixth.purchase.state, 'blocked'); assert.equal(sixth.snapshot.spentMinor, 21980); assert.equal(sixth.snapshot.availableMinor, 3020);
});

test('idempotency is stable per owner and payload, owner references cannot be borrowed, and provider mode stays blocked', t => {
  const store = new FamilyBudgetStore(); t.after(() => store.close());
  const first = request(store, 'stable-key');
  assert.deepEqual(request(store, 'stable-key'), first);
  assert.throws(() => request(store, 'stable-key', 'spark-coins-100'), { code: 'CONFLICT' });
  assert.throws(() => store.request(owner, { itemId: 'family-wallet-four', idempotencyKey: 'stable-key' }, 'provider-test'), { code: 'CONFLICT' });
  assert.notEqual(request(store, 'stable-key', 'family-wallet-four', other).purchase.id, first.purchase.id);
  assert.throws(() => store.transition(other, first.purchase.id, 'completed', 'local-demo'), { code: 'NOT_FOUND' });
  assert.throws(() => store.transition(owner, first.purchase.id, 'completed', 'verified-provider' as 'local-demo'), { code: 'FORBIDDEN' });
  assert.throws(() => store.transition(owner, first.purchase.id, 'expired', 'local-demo'), { code: 'CONFLICT' });
  const provider = store.request(owner, { itemId: 'family-wallet-four', idempotencyKey: 'provider-only' }, 'provider-test');
  assert.equal(provider.purchase.state, 'blocked'); assert.match(provider.purchase.reason, /Verified parent linkage/);
  assert.equal(provider.snapshot.reservedMinor, 0); assert.equal(provider.snapshot.spentMinor, 0);
  assert.equal(provider.purchase.paid, false); assert.equal(provider.purchase.fulfilled, false);
  assert.throws(() => store.transition(owner, provider.purchase.id, 'completed', 'local-demo'), { code: 'FORBIDDEN' });
  assert.equal(store.snapshot(owner).reservedMinor, 4396);
});

test('expiration releases once at the deadline and late completion cannot revive the original idempotent request', t => {
  let now = Date.parse('2026-10-21T12:00:00.000Z');
  const store = new FamilyBudgetStore(':memory:', { now: () => now, reservationTtlMs: 1000 }); t.after(() => store.close());
  const first = request(store, 'expires');
  now += 999; assert.equal(store.snapshot(owner).reservedMinor, 4396);
  now += 1;
  const expired = store.snapshot(owner);
  assert.equal(expired.requests[0].state, 'expired'); assert.equal(expired.reservedMinor, 0); assert.equal(expired.availableMinor, 25000);
  assert.throws(() => store.transition(owner, first.purchase.id, 'completed', 'local-demo'), { code: 'CONFLICT' });
  assert.equal(store.transition(owner, first.purchase.id, 'expired', 'local-demo').purchase.state, 'expired');
  assert.equal(request(store, 'expires').purchase.state, 'expired');
  assert.equal(store.snapshot(owner).reservedMinor, 0);
});

test('UTC calendar boundaries expire carryover reservations and completed spend belongs to its original month', t => {
  let now = Date.parse('2026-10-31T23:59:59.500Z');
  const store = new FamilyBudgetStore(':memory:', { now: () => now, reservationTtlMs: 10000 }); t.after(() => store.close());
  const carryover = request(store, 'carryover').purchase;
  assert.equal(carryover.expiresAt, '2026-11-01T00:00:00.000Z');
  const completed = request(store, 'october-spend').purchase;
  store.transition(owner, completed.id, 'completed', 'local-demo');
  assert.equal(store.snapshot(owner).spentMinor, 4396);
  now = Date.parse('2026-11-01T00:00:00.000Z');
  const november = store.snapshot(owner);
  assert.deepEqual(november.period, { key: '2026-11', startsAt: '2026-11-01T00:00:00.000Z', endsAt: '2026-12-01T00:00:00.000Z' });
  assert.equal(november.spentMinor, 0); assert.equal(november.reservedMinor, 0); assert.equal(november.availableMinor, 25000);
  assert.equal(november.requests.find(row => row.id === carryover.id)?.state, 'expired');
  assert.throws(() => store.transition(owner, carryover.id, 'completed', 'local-demo'), { code: 'CONFLICT' });
  assert.equal(request(store, 'carryover').purchase.state, 'expired');
  assert.equal(store.transition(owner, completed.id, 'completed', 'local-demo').snapshot.spentMinor, 0);
  for (let i = 0; i < 5; i++) assert.equal(request(store, `november-${i}`).purchase.state, 'pending');
  assert.equal(request(store, 'november-over-limit').purchase.state, 'blocked');
});

test('sample reset isolates owners, preserves replay receipts and cannot reset provider-test records', t => {
  const store = new FamilyBudgetStore(); t.after(() => store.close());
  const completed = request(store, 'old-spend').purchase;
  store.transition(owner, completed.id, 'completed', 'local-demo');
  const pending = request(store, 'old-reservation').purchase;
  const second = request(store, 'other-family', 'family-wallet-four', other).purchase;
  const provider = store.request(owner, { itemId: 'spark-coins-100', idempotencyKey: 'provider-receipt' }, 'provider-test');
  const reset = store.reset(owner);
  assert.equal(reset.spentMinor, 0); assert.equal(reset.reservedMinor, 0); assert.equal(reset.availableMinor, 25000); assert.deepEqual(reset.requests, []);
  assert.equal(store.snapshot(other).requests[0].id, second.id); assert.equal(store.snapshot(other).reservedMinor, 4396);
  assert.equal(request(store, 'old-reservation').purchase.state, 'cancelled');
  assert.equal(request(store, 'old-spend').purchase.state, 'completed');
  assert.equal(store.snapshot(owner).spentMinor, 0); assert.equal(store.snapshot(owner).reservedMinor, 0);
  assert.throws(() => store.transition(owner, pending.id, 'completed', 'local-demo'), { code: 'CONFLICT' });
  assert.equal(store.transition(owner, completed.id, 'completed', 'local-demo').snapshot.spentMinor, 0);
  assert.throws(() => request(store, 'old-spend', 'spark-coins-100'), { code: 'CONFLICT' });
  assert.throws(() => store.reset(owner, 'provider-test'), { code: 'FORBIDDEN' });
  assert.deepEqual(store.snapshot(owner, 'provider-test').requests, [provider.purchase]);
  assert.equal(request(store, 'new-generation').snapshot.reservedMinor, 4396);
});

test('SQLite persistence retains terminal spend and receipts across store restart and independent connections', t => {
  const directory = mkdtempSync(join(tmpdir(), 'sample-family-budget-')); t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, 'budget.sqlite');
  const first = new FamilyBudgetStore(path);
  const purchase = request(first, 'persist').purchase;
  first.transition(owner, purchase.id, 'completed', 'local-demo'); first.close();
  const second = new FamilyBudgetStore(path), third = new FamilyBudgetStore(path);
  t.after(() => { second.close(); third.close(); });
  assert.equal(second.snapshot(owner).spentMinor, 4396);
  assert.equal(request(third, 'persist').purchase.id, purchase.id); assert.equal(third.snapshot(owner).spentMinor, 4396);
  assert.equal(third.transition(owner, purchase.id, 'completed', 'local-demo').snapshot.spentMinor, 4396);
  assert.equal(second.snapshot(owner).requests.length, 1);
});

test('bounded receipt storage fails closed and resets never evict idempotency protection', t => {
  const store = new FamilyBudgetStore(); t.after(() => store.close());
  const first = request(store, 'retained-0', 'verification-pack').purchase;
  for (let i = 1; i < 200; i++) request(store, `retained-${i}`, 'verification-pack');
  assert.throws(() => request(store, 'receipt-201', 'verification-pack'), { code: 'LIMITED' });
  assert.equal(store.snapshot(owner).requests.length, 200);
  store.reset(owner);
  assert.deepEqual(store.snapshot(owner).requests, []);
  assert.deepEqual(request(store, 'retained-0', 'verification-pack').purchase, first);
  assert.throws(() => request(store, 'receipt-after-reset', 'verification-pack'), { code: 'LIMITED' });
  assert.equal(store.snapshot(owner).reservedMinor, 0);
});

test('concurrent independent server processes cannot oversubscribe the monthly SQLite reservation', { timeout: 30000 }, async t => {
  const directory = mkdtempSync(join(tmpdir(), 'sample-family-concurrency-')); t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, 'budget.sqlite');
  const initial = new FamilyBudgetStore(path); initial.close();
  const children: ChildProcess[] = []; t.after(() => children.forEach(child => child.kill()));
  const moduleUrl = new URL('../apps/api/src/family-budget.ts', import.meta.url).href;
  const launch = (key: string) => {
    const script = `import { FamilyBudgetStore } from ${JSON.stringify(moduleUrl)};
      const store = new FamilyBudgetStore(process.argv[1]);
      process.send('ready');
      process.once('message', () => {
        try { const result = store.request('concurrent-owner', {itemId:'family-wallet-four',idempotencyKey:process.argv[2]});
          store.close(); process.send({id:result.purchase.id,state:result.purchase.state}); process.disconnect();
        } catch(error) { process.stderr.write(String(error)); process.exit(1); }
      });`;
    const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', script, path, key], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
    children.push(child);
    let stderr = ''; child.stderr!.on('data', value => { stderr += value; });
    const ready = new Promise<void>((resolve, reject) => {
      child.once('message', () => resolve()); child.once('error', reject);
      child.once('exit', code => { if (code) reject(new Error(`Concurrent worker failed: ${stderr}`)); });
    });
    const result = new Promise<{ id: string; state: string }>((resolve, reject) => {
      child.on('message', message => { if (typeof message === 'object' && message !== null) resolve(message as { id: string; state: string }); });
      child.once('error', reject); child.once('exit', code => { if (code) reject(new Error(`Concurrent worker failed: ${stderr}`)); });
    });
    return { child, ready, result };
  };
  // Duplicate keys race alongside distinct requests. At most five $43.96 holds may win.
  const workers = ['duplicate', 'duplicate', 'one', 'two', 'three', 'four', 'five', 'six'].map(launch);
  await Promise.all(workers.map(worker => worker.ready));
  workers.forEach(worker => worker.child.send('reserve'));
  const results = await Promise.all(workers.map(worker => worker.result));
  assert.equal(results[0].id, results[1].id);
  const store = new FamilyBudgetStore(path); t.after(() => store.close());
  const snapshot = store.snapshot('concurrent-owner');
  assert.equal(snapshot.reservedMinor, 21980); assert.equal(snapshot.availableMinor, 3020);
  assert.equal(snapshot.requests.filter(row => row.state === 'pending').length, 5);
  assert.equal(snapshot.requests.length, 7); assert.equal(snapshot.requests.filter(row => row.state === 'blocked').length, 2);
});
