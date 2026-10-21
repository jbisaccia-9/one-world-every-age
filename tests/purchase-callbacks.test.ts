import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyFastSpringCallback, verifyKidCallback, type CallbackHeaders } from '../apps/api/src/purchase-callbacks.js';

// Synthetic signatures and events only; never provider credentials or live calls.
const syntheticKey = 'synthetic-callback-test-only';
const now = Date.parse('2026-10-21T12:00:00.000Z');
const timestamp = String(now / 1000);
const fastspringBody = Buffer.from('{ "events": [{ "id": "synthetic-event", "live": false, "type": "order.completed", "data": { "id": "synthetic-order", "completed": true, "currency": "USD", "total": 1 } }] }\n');
const kidBody = Buffer.from(JSON.stringify({
  eventType: 'Transaction.PurchaseApprovalResult', data: {
    id: '9d4e2f81-7a3b-4c56-8e90-1f2a3b4c5d6e', sessionId: 'b1a6482d-5242-4b4a-aa88-3fa52595a672',
    productId: 42, status: 'approved', resolvedAt: '2026-10-21T12:00:00Z',
  },
}));
const fsHeaders = (body: Uint8Array = fastspringBody): CallbackHeaders => ({
  'X-FS-Signature': createHmac('sha256', syntheticKey).update(body).digest('base64'),
});
const kidHeaders = (body: Uint8Array = kidBody, sentAt = timestamp): CallbackHeaders => ({
  'X-Signature-Timestamp': sentAt,
  'X-Signature-Hmac-Sha256': createHmac('sha256', syntheticKey).update(sentAt).update(body).digest('hex'),
});

test('FastSpring prepared verifier authenticates raw bytes with base64 SHA256 but performs no business transition', () => {
  const verified = verifyFastSpringCallback(fastspringBody, fsHeaders(), syntheticKey);
  assert.equal(verified.provider, 'FastSpring'); assert.equal(verified.signatureVerified, true);
  assert.equal(verified.businessValidation, 'not-performed'); assert.match(verified.bodyHash, /^[0-9a-f]{64}$/);
  assert.deepEqual(verified.payload, JSON.parse(fastspringBody.toString()));
  assert.equal('paid' in verified, false); assert.equal('fulfilled' in verified, false);
  // Whitespace and trailing newline are part of the signature. Re-serialization is invalid.
  const reformatted = Buffer.from(JSON.stringify(verified.payload));
  assert.throws(() => verifyFastSpringCallback(reformatted, fsHeaders(), syntheticKey), { code: 'UNAUTHORIZED' });
  assert.throws(() => verifyFastSpringCallback(fastspringBody, fsHeaders(), 'different-test-key'), { code: 'UNAUTHORIZED' });
  assert.deepEqual(verifyFastSpringCallback(fastspringBody, fsHeaders(), syntheticKey), verified);
});

test('signature headers are case-insensitive by name and reject malformed, repeated, or combined values', () => {
  const signature = fsHeaders()['X-FS-Signature'] as string;
  assert.equal(verifyFastSpringCallback(fastspringBody, { 'x-fs-signature': signature }, syntheticKey).signatureVerified, true);
  for (const headers of [
    {}, { 'X-FS-Signature': [signature] }, { 'X-FS-Signature': signature, 'x-fs-signature': signature },
    { 'X-FS-Signature': `${signature},${signature}` }, { 'X-FS-Signature': ` ${signature}` },
    { 'X-FS-Signature': signature.slice(0, -1) }, { 'X-FS-Signature': 'a'.repeat(44) },
    { 'X-FS-Signature': Buffer.alloc(32).toString('base64') },
  ]) assert.throws(() => verifyFastSpringCallback(fastspringBody, headers, syntheticKey), { code: 'UNAUTHORIZED' });
});

test('both providers fail closed without a configured secret and never expose it in errors', () => {
  for (const absent of [undefined, '', '   ']) {
    assert.throws(() => verifyFastSpringCallback(fastspringBody, fsHeaders(), absent), { code: 'UNAVAILABLE' });
    assert.throws(() => verifyKidCallback(kidBody, kidHeaders(), absent, { now: () => now }), { code: 'UNAVAILABLE' });
  }
  try { verifyFastSpringCallback(fastspringBody, {}, syntheticKey); assert.fail('Expected signature rejection'); }
  catch (error) { assert.equal(String(error).includes(syntheticKey), false); }
});

test('k-ID verifies timestamp text plus exact raw UTF-8 body and preserves approval as unprocessed data', () => {
  const verified = verifyKidCallback(kidBody, kidHeaders(), syntheticKey, { now: () => now });
  assert.equal(verified.provider, 'k-ID'); assert.equal(verified.signatureVerified, true);
  assert.equal(verified.businessValidation, 'not-performed'); assert.deepEqual(verified.payload, JSON.parse(kidBody.toString()));
  assert.equal('paid' in verified, false); assert.equal('fulfilled' in verified, false);
  assert.throws(() => verifyKidCallback(Buffer.concat([kidBody, Buffer.from('\n')]), kidHeaders(), syntheticKey, { now: () => now }), { code: 'UNAUTHORIZED' });
  assert.throws(() => verifyKidCallback(kidBody, kidHeaders(), 'different-test-key', { now: () => now }), { code: 'UNAUTHORIZED' });
  const unicode = Buffer.from('{"message":"synthetic café 🌱"}');
  assert.equal(verifyKidCallback(unicode, kidHeaders(unicode), syntheticKey, { now: () => now }).payload.message, 'synthetic café 🌱');
});

test('k-ID local receive window accepts its exact boundary and rejects stale/future or malformed timestamps', () => {
  for (const seconds of [-300, 0, 300]) {
    const sentAt = String(now / 1000 + seconds);
    assert.equal(verifyKidCallback(kidBody, kidHeaders(kidBody, sentAt), syntheticKey, { now: () => now }).signatureVerified, true);
  }
  for (const sentAt of [String(now / 1000 - 301), String(now / 1000 + 301), `0${timestamp}`, ` ${timestamp}`, `${timestamp}.0`, 'NaN', '-1', '999999999999999999999999']) {
    assert.throws(() => verifyKidCallback(kidBody, kidHeaders(kidBody, sentAt), syntheticKey, { now: () => now }), { code: 'UNAUTHORIZED' });
  }
  assert.throws(() => verifyKidCallback(kidBody, kidHeaders(), syntheticKey, { now: () => now, toleranceSeconds: 3601 }), /receive window/);
});

test('k-ID rejects ambiguous headers and malformed hex before any constant-time comparison', () => {
  const valid = kidHeaders(), signature = valid['X-Signature-Hmac-Sha256'] as string;
  for (const headers of [
    {}, { ...valid, 'X-Signature-Timestamp': [timestamp] }, { ...valid, 'x-signature-timestamp': timestamp },
    { ...valid, 'X-Signature-Hmac-Sha256': [signature] }, { ...valid, 'X-Signature-Hmac-Sha256': signature.toUpperCase() },
    { ...valid, 'X-Signature-Hmac-Sha256': signature.slice(1) }, { ...valid, 'X-Signature-Hmac-Sha256': 'g'.repeat(64) },
  ]) assert.throws(() => verifyKidCallback(kidBody, headers, syntheticKey, { now: () => now }), { code: 'UNAUTHORIZED' });
});

test('valid signatures still reject malformed JSON, invalid UTF-8, empty and oversized raw bodies', () => {
  for (const body of [Buffer.from('{'), Buffer.from('[]'), Buffer.from('null'), Buffer.from([0xff, 0xfe])]) {
    assert.throws(() => verifyFastSpringCallback(body, fsHeaders(body), syntheticKey), { code: 'INVALID_REQUEST' });
    assert.throws(() => verifyKidCallback(body, kidHeaders(body), syntheticKey, { now: () => now }), { code: 'INVALID_REQUEST' });
  }
  for (const body of [Buffer.alloc(0), Buffer.alloc(1024 * 1024 + 1)]) {
    assert.throws(() => verifyFastSpringCallback(body, {}, syntheticKey), { code: 'INVALID_REQUEST' });
    assert.throws(() => verifyKidCallback(body, {}, syntheticKey, { now: () => now }), { code: 'INVALID_REQUEST' });
  }
  // This is a raw-byte API: passing a parsed object can never be a shortcut.
  assert.throws(() => verifyFastSpringCallback({ events: [] } as unknown as Uint8Array, {}, syntheticKey), { code: 'INVALID_REQUEST' });
});
