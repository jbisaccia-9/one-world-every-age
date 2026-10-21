import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { ownedAssessmentResponseSchema } from '@beacon/contracts';
import { familyBudgetResultSchema, familyBudgetSnapshotSchema } from '@beacon/contracts/family-budget';
import { BackendService } from '../apps/api/src/backend.js';
import { createApp } from '../apps/api/src/server.js';
import type { PermissionAdapter, KidResult } from '../apps/api/src/kid.js';
import { UnavailableReasoningAdapter } from '../apps/api/src/gemini.js';
import { UnavailableSpeechAdapter } from '../apps/api/src/inworld.js';
import { UnavailableRedactionAdapter } from '../apps/api/src/modulate.js';
import { UnavailableCheckoutAdapter } from '../apps/api/src/fastspring.js';

type Session = { credential: string; ownerId: string; contextVersion: number; onboardingState: string };

test('family budget HTTP routes preserve authentication, ownership, current context and sample-only provenance', async t => {
  const clock = Date.parse('2026-10-21T12:00:00.000Z');
  let checkoutCalls = 0;
  const syntheticSessionId = randomUUID();
  const result: KidResult = {
    state: 'active', link: { sessionId: syntheticSessionId }, session: {
      sessionId: syntheticSessionId, status: 'ACTIVE', ageStatus: 'LEGAL_ADULT', jurisdiction: 'US-CA',
      permissions: [{ name: 'in-game-purchases', enabled: true, managedBy: 'PLAYER' }],
    },
  };
  // Explicit injected permission simulation; every other adapter is unavailable.
  // Neither environment credentials nor external vendor transports are selected.
  const adapter: PermissionAdapter = {
    transport: 'test-fake', mappingConfirmed: true, purchaseMappingConfirmed: true,
    async start() { return result; }, async refresh() { return result; },
    status() { return { status: 'mock', environment: 'k-ID Test Mode', detail: 'Synthetic permission response for budget HTTP tests only.' }; },
  };
  class NoCheckout extends UnavailableCheckoutAdapter {
    async checkout(): Promise<never> { checkoutCalls++; throw new Error('Budget tests must never dispatch checkout.'); }
  }
  const backend = new BackendService({
    now: () => clock, adapter, allowTestAdapter: true,
    reasoning: new UnavailableReasoningAdapter(), speech: new UnavailableSpeechAdapter(),
    redaction: new UnavailableRedactionAdapter(), checkout: new NoCheckout(),
  });
  const app = createApp({ backend });
  await new Promise<void>((resolve, reject) => { app.once('error', reject); app.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise<void>(resolve => { app.close(() => resolve()); app.closeAllConnections(); }));
  const base = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
  const get = (path: string, session?: Session) => fetch(`${base}${path}`, { headers: session ? { Authorization: `Bearer ${session.credential}` } : {} });
  const post = (path: string, body: unknown, session?: Session) => fetch(`${base}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.credential}` } : {}) }, body: JSON.stringify(body),
  });
  const start = async (mode: 'local-demo' | 'provider-test' = 'local-demo') => {
    const response = await post('/api/onboarding/session', { mode, syntheticProfile: 'adult', jurisdiction: 'US-CA', optIns: { cloudAnalysis: false, spokenCoaching: false, memory: false } });
    assert.equal(response.status, 201); return await response.json() as Session;
  };
  const assess = async (session: Session) => {
    const response = await post('/api/assessments', { contextVersion: session.contextVersion, fixtureId: 'P01', variant: 'baseline' }, session);
    assert.equal(response.status, 201); return ownedAssessmentResponseSchema.parse(await response.json()).assessment;
  };
  const input = (session: Session, assessmentId: string, idempotencyKey = randomUUID()) => ({ contextVersion: session.contextVersion, assessmentId, itemId: 'family-wallet-four', idempotencyKey });
  const snapshot = async (session: Session) => {
    const response = await get('/api/family-budget', session); assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store'); return familyBudgetSnapshotSchema.parse(await response.json());
  };

  await t.test('GET and mutations require a bearer session before private bodies are accepted', async () => {
    assert.equal((await get('/api/family-budget')).status, 401);
    for (const path of ['/api/family-budget/requests', '/api/family-budget/reset', `/api/family-budget/requests/${randomUUID()}/cancel`, `/api/family-budget/requests/${randomUUID()}/simulate`]) {
      assert.equal((await post(path, {})).status, 401);
    }
    const session = await start(), view = await snapshot(session);
    assert.equal(view.mode, 'local-demo'); assert.equal(view.policy.source, 'local-sample');
    assert.equal(view.availableMinor, 25000); assert.deepEqual(view.requests, []);
  });

  await t.test('requests require an owned assessment and reject browser prices, owners, policy and approval', async () => {
    const session = await start(), another = await start();
    const assessment = await assess(session), foreign = await assess(another), body = input(session, assessment.id);
    assert.equal((await post('/api/family-budget/requests', { ...body, assessmentId: foreign.id }, session)).status, 404);
    assert.equal((await post('/api/family-budget/requests', { ...body, assessmentId: randomUUID() }, session)).status, 404);
    const { assessmentId: _omitted, ...missing } = body;
    assert.equal((await post('/api/family-budget/requests', missing, session)).status, 400);
    for (const extra of [{ amountMinor: 1 }, { quantity: 1 }, { productPath: 'spark-coins-100' }, { currency: 'EUR' }, { ownerId: another.ownerId }, { approved: true }, { parentApproval: 'verified' }, { source: 'verified-provider' }, { monthlyMinor: 999999 }]) {
      assert.equal((await post('/api/family-budget/requests', { ...body, ...extra }, session)).status, 400);
    }
    assert.deepEqual((await snapshot(session)).requests, []);
    const response = await post('/api/family-budget/requests', body, session); assert.equal(response.status, 200);
    const reserved = familyBudgetResultSchema.parse(await response.json());
    assert.equal(reserved.purchase.state, 'pending'); assert.equal(reserved.purchase.amountMinor, 4396); assert.equal(reserved.snapshot.reservedMinor, 4396);
    assert.equal(reserved.purchase.paid, false); assert.equal(reserved.purchase.fulfilled, false);
  });

  await t.test('stable replays reserve once and another owner cannot cancel or complete the request', async () => {
    const session = await start(), another = await start(), assessment = await assess(session), body = input(session, assessment.id);
    const first = familyBudgetResultSchema.parse(await (await post('/api/family-budget/requests', body, session)).json());
    const retry = familyBudgetResultSchema.parse(await (await post('/api/family-budget/requests', body, session)).json());
    assert.deepEqual(retry, first); assert.equal(retry.snapshot.requests.length, 1);
    for (const action of ['cancel', 'simulate']) {
      assert.equal((await post(`/api/family-budget/requests/${first.purchase.id}/${action}`, { contextVersion: another.contextVersion, ...(action === 'simulate' ? { outcome: 'completed' } : {}) }, another)).status, 404);
    }
    assert.equal((await snapshot(session)).reservedMinor, 4396); assert.equal((await snapshot(another)).reservedMinor, 0);
    assert.equal((await post('/api/family-budget/requests', { ...body, itemId: 'spark-coins-100' }, session)).status, 409);
    const completion = { contextVersion: session.contextVersion, outcome: 'completed' };
    for (let i = 0; i < 2; i++) {
      const response = await post(`/api/family-budget/requests/${first.purchase.id}/simulate`, completion, session); assert.equal(response.status, 200);
      const completed = familyBudgetResultSchema.parse(await response.json());
      assert.equal(completed.snapshot.spentMinor, 4396); assert.equal(completed.snapshot.reservedMinor, 0);
      assert.equal(completed.purchase.paid, false); assert.equal(completed.purchase.fulfilled, false);
    }
    const terminalRetry = familyBudgetResultSchema.parse(await (await post('/api/family-budget/requests', body, session)).json());
    assert.equal(terminalRetry.purchase.id, first.purchase.id); assert.equal(terminalRetry.purchase.state, 'completed'); assert.equal(terminalRetry.snapshot.spentMinor, 4396);
  });

  await t.test('even an active simulated adult provider context cannot authorize real budget purchases or local outcomes', async () => {
    const session = await start('provider-test'), assessment = await assess(session);
    assert.equal(session.onboardingState, 'active');
    const response = await post('/api/family-budget/requests', input(session, assessment.id), session); assert.equal(response.status, 200);
    const denied = familyBudgetResultSchema.parse(await response.json());
    assert.equal(denied.purchase.state, 'blocked'); assert.equal(denied.snapshot.reservedMinor, 0); assert.equal(denied.snapshot.spentMinor, 0);
    assert.match(denied.purchase.reason, /Verified parent linkage/);
    assert.equal((await post(`/api/family-budget/requests/${denied.purchase.id}/simulate`, { contextVersion: session.contextVersion, outcome: 'completed' }, session)).status, 403);
    assert.equal((await post(`/api/family-budget/requests/${denied.purchase.id}/cancel`, { contextVersion: session.contextVersion }, session)).status, 403);
    assert.equal((await post('/api/family-budget/reset', { contextVersion: session.contextVersion }, session)).status, 403);
    assert.deepEqual((await snapshot(session)).requests, [denied.purchase]);
  });

  await t.test('stale context blocks request, cancellation, completion and reset without changing the ledger', async () => {
    const session = await start(), assessment = await assess(session), body = input(session, assessment.id);
    const pending = familyBudgetResultSchema.parse(await (await post('/api/family-budget/requests', body, session)).json());
    const changed = await post('/api/onboarding/context', { contextVersion: session.contextVersion, optIns: { cloudAnalysis: true, spokenCoaching: false, memory: false } }, session);
    assert.equal(changed.status, 200); const current = await changed.json(); assert.ok(current.contextVersion > session.contextVersion);
    assert.equal((await post('/api/family-budget/requests', { ...body, idempotencyKey: randomUUID() }, session)).status, 409);
    assert.equal((await post(`/api/family-budget/requests/${pending.purchase.id}/cancel`, { contextVersion: session.contextVersion }, session)).status, 409);
    assert.equal((await post(`/api/family-budget/requests/${pending.purchase.id}/simulate`, { contextVersion: session.contextVersion, outcome: 'completed' }, session)).status, 409);
    assert.equal((await post('/api/family-budget/reset', { contextVersion: session.contextVersion }, session)).status, 409);
    assert.equal((await post('/api/family-budget/requests', { ...body, contextVersion: current.contextVersion, idempotencyKey: randomUUID() }, session)).status, 409);
    assert.equal((await snapshot(session)).reservedMinor, 4396); assert.equal((await snapshot(session)).spentMinor, 0);
    const cancel = await post(`/api/family-budget/requests/${pending.purchase.id}/cancel`, { contextVersion: current.contextVersion }, session);
    assert.equal(cancel.status, 200); assert.equal(familyBudgetResultSchema.parse(await cancel.json()).snapshot.reservedMinor, 0);
  });
  assert.equal(checkoutCalls, 0);
});
