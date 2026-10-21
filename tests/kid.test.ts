import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp, type KidServerOptions } from '../apps/api/src/server.js';

// Starts the API with an optional fake k-ID, so no test ever calls the real provider.
async function start(t: test.TestContext, kid?: KidServerOptions) {
  const app = createApp({ kid });
  await new Promise<void>(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>(resolve => { app.close(() => resolve()); app.closeAllConnections(); }));
  const base = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
  return (path: string, body: unknown) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
const sessionId = '3f1c2a9e-8b7d-4c6e-9a1b-2d3e4f5a6b7c';

test('claim token is accepted, never echoed, and reported as an honest blocker', async t => {
  const post = await start(t);
  const response = await post('/api/kid/claim', { claimToken: 'one-time-claim-token-value' });
  assert.equal(response.status, 202);
  const text = await response.text();
  assert.doesNotMatch(text, /one-time-claim-token-value/);
  assert.equal(JSON.parse(text).redeemed, false);
  for (const body of [{}, { claimToken: 42 }, { claimToken: 'short' }, { claimToken: 'one-time-claim-token-value', sessionId }]) assert.equal((await post('/api/kid/claim', body)).status, 400);
});

test('session read reports not configured without a server key', async t => {
  const post = await start(t);
  const response = await post('/api/kid/session', { sessionId });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).status, 'not configured');
  assert.equal((await post('/api/kid/session', { sessionId: 'not-a-uuid' })).status, 400);
});

test('session read uses the secret key server-side and returns only known fields', async t => {
  let seen: { url: string; auth: string | null } | undefined;
  const fakeFetch: typeof fetch = async (input, init) => {
    seen = { url: String(input), auth: new Headers(init?.headers).get('Authorization') };
    return new Response(JSON.stringify({ sessionId, ageStatus: 'CHILD', jurisdiction: 'US-CA', etag: 'x', permissions: [{ name: 'ai-chat', enabled: false, managedBy: 'GUARDIAN' }, { name: 'in-game-purchases', enabled: true, managedBy: 'GUARDIAN' }] }), { status: 200 });
  };
  const post = await start(t, { apiKey: 'test-secret-key', baseUrl: 'https://game-api.test.k-id.com/', fetch: fakeFetch });
  const response = await post('/api/kid/session', { sessionId });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(seen?.url, `https://game-api.test.k-id.com/api/v1/session/get?sessionId=${sessionId}`);
  assert.equal(seen?.auth, 'Bearer test-secret-key');
  assert.equal(body.provenance, 'k-ID test');
  assert.deepEqual(body.permissions.map((p: { name: string }) => p.name), ['ai-chat', 'in-game-purchases']);
  assert.equal('etag' in body, false);
  assert.doesNotMatch(JSON.stringify(body), /test-secret-key/);
});

test('provider failures are reported, never turned into access', async t => {
  const down = await start(t, { apiKey: 'k', fetch: async () => { throw new Error('offline'); } });
  assert.equal((await down('/api/kid/session', { sessionId })).status, 502);
  const odd = await start(t, { apiKey: 'k', fetch: async () => new Response(JSON.stringify({ unexpected: true }), { status: 200 }) });
  assert.equal((await odd('/api/kid/session', { sessionId })).status, 502);
  const denied = await start(t, { apiKey: 'k', fetch: async () => new Response('{}', { status: 401 }) });
  assert.equal((await denied('/api/kid/session', { sessionId })).status, 502);
});
