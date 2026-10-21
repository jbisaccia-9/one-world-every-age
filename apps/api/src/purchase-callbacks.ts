import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { BackendError } from './errors.js';

export type CallbackHeaders = Readonly<Record<string, string | string[] | undefined>>;
export type VerifiedPurchaseCallback = {
  provider: 'FastSpring' | 'k-ID'; signatureVerified: true; businessValidation: 'not-performed';
  bodyHash: string; payload: Record<string, unknown>;
};
const maxCallbackBytes = 1024 * 1024;
const unauthorized = () => new BackendError(401, 'UNAUTHORIZED', 'Purchase callback signature is missing, invalid or outside the accepted time window.');
function secretKey(secret: string | undefined) {
  if (typeof secret !== 'string' || !secret.trim()) throw new BackendError(503, 'UNAVAILABLE', 'Purchase callback verification is not configured.');
  return secret;
}
function rawBytes(rawBody: Uint8Array) {
  if (!(rawBody instanceof Uint8Array) || rawBody.byteLength < 1 || rawBody.byteLength > maxCallbackBytes) {
    throw new BackendError(400, 'INVALID_REQUEST', 'Purchase callback must contain a bounded raw JSON body.');
  }
  return Buffer.from(rawBody);
}
function singleHeader(headers: CallbackHeaders, name: string) {
  const matches = Object.entries(headers).filter(([key, value]) => key.toLowerCase() === name && value !== undefined);
  if (matches.length !== 1 || typeof matches[0][1] !== 'string') throw unauthorized();
  return matches[0][1];
}
function parsed(provider: VerifiedPurchaseCallback['provider'], body: Buffer): VerifiedPurchaseCallback {
  let payload: unknown;
  try { payload = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(body)); }
  catch { throw new BackendError(400, 'INVALID_REQUEST', 'Purchase callback is not valid UTF-8 JSON.'); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new BackendError(400, 'INVALID_REQUEST', 'Purchase callback JSON must be an object.');
  }
  return {
    provider, signatureVerified: true, businessValidation: 'not-performed',
    bodyHash: createHash('sha256').update(body).digest('hex'), payload: payload as Record<string, unknown>,
  };
}

/**
 * Prepared verifier only; no route, event consumption, charge or fulfillment.
 * Official wire contract: https://developer.fastspring.com/reference/message-security
 * Verify raw bytes before JSON parsing. FastSpring signs no timestamp, so callers
 * must persist event and order/resource correlation to reject replays, including
 * manual retries that get new event IDs. Never infer payment from signature alone.
 */
export function verifyFastSpringCallback(rawBody: Uint8Array, headers: CallbackHeaders, secret: string | undefined): VerifiedPurchaseCallback {
  const key = secretKey(secret), body = rawBytes(rawBody), signature = singleHeader(headers, 'x-fs-signature');
  if (!/^[A-Za-z0-9+/]{43}=$/.test(signature)) throw unauthorized();
  const received = Buffer.from(signature, 'base64');
  if (received.length !== 32 || received.toString('base64') !== signature) throw unauthorized();
  const expected = createHmac('sha256', key).update(body).digest();
  if (!timingSafeEqual(received, expected)) throw unauthorized();
  return parsed('FastSpring', body);
}

/**
 * Official wire contract: https://docs.k-id.com/webhooks
 * HMAC covers timestamp text immediately followed by the raw UTF-8 JSON body.
 * A five-minute receive window is local application policy, not a vendor claim.
 * PurchaseApprovalResult is an approval decision, never proof of payment. Callers
 * still need stored request ID/session/product/deadline, linked-parent validation
 * and transactional deduplication on data.id before any business action.
 */
export function verifyKidCallback(
  rawBody: Uint8Array, headers: CallbackHeaders, secret: string | undefined,
  options: { now?: () => number; toleranceSeconds?: number } = {},
): VerifiedPurchaseCallback {
  const key = secretKey(secret), body = rawBytes(rawBody);
  const timestamp = singleHeader(headers, 'x-signature-timestamp');
  const signature = singleHeader(headers, 'x-signature-hmac-sha256');
  const now = (options.now ?? Date.now)(), tolerance = options.toleranceSeconds ?? 300;
  if (!Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(tolerance) || tolerance < 0 || tolerance > 3600) {
    throw new Error('Invalid callback clock or receive window.');
  }
  if (!/^(0|[1-9][0-9]{0,11})$/.test(timestamp) || !/^[0-9a-f]{64}$/.test(signature)) throw unauthorized();
  const milliseconds = Number(timestamp) * 1000;
  if (!Number.isSafeInteger(milliseconds) || Math.abs(now - milliseconds) > tolerance * 1000) throw unauthorized();
  const expected = createHmac('sha256', key).update(timestamp, 'utf8').update(body).digest();
  const received = Buffer.from(signature, 'hex');
  if (!timingSafeEqual(received, expected)) throw unauthorized();
  return parsed('k-ID', body);
}
