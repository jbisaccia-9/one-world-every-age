import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { demoRequestSchema, structuredErrorSchema } from '@beacon/contracts';
import { baselineFixtures, providerStatuses, renderDemo, scenarioCatalog } from '@beacon/fixtures';
import { z } from 'zod';

// The parts of a k-ID session we use (fields per the @k-id/core schema). Extra fields are dropped.
const kidSessionSchema = z.object({
  sessionId: z.string(), ageStatus: z.string(), jurisdiction: z.string().optional(),
  permissions: z.array(z.object({ name: z.string(), enabled: z.boolean(), managedBy: z.enum(['PLAYER', 'GUARDIAN', 'PROHIBITED']).optional() })),
});

const maxBodyBytes = 4096;
// k-ID server-side access. The API key is the secret key and never leaves this process.
export interface KidServerOptions { apiKey?: string; baseUrl?: string; fetch?: typeof fetch }
export interface ServerOptions { companionOrigin?: string; extensionOrigins?: string[]; kid?: KidServerOptions }
function localOrigin(input: string): string {
  const url = new URL(input);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.origin !== input) throw new Error('Companion origin must be an exact loopback HTTP origin');
  return url.origin;
}
export function createApp(options: ServerOptions = {}) {
  const companionOrigin = localOrigin(options.companionOrigin ?? 'http://127.0.0.1:5173');
  const extensions = options.extensionOrigins ?? [];
  if (extensions.some(origin => !/^chrome-extension:\/\/[a-p]{32}$/.test(origin))) throw new Error('Invalid extension origin configuration');
  const allowedOrigins = new Set([companionOrigin, ...extensions]);
  const kid = { apiKey: options.kid?.apiKey || undefined, baseUrl: (options.kid?.baseUrl || 'https://game-api.test.k-id.com').replace(/\/+$/, ''), fetch: options.kid?.fetch ?? fetch };
  const json = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(body));
  };
  const error = (res: ServerResponse, status: number, code: 'INVALID_REQUEST' | 'NOT_FOUND' | 'FORBIDDEN' | 'TOO_LARGE' | 'INTERNAL', message: string) => json(res, status, structuredErrorSchema.parse({ code, message, retryable: false, requestId: randomUUID() }));
  // Reads a small JSON body; on failure it has already sent the error and returns undefined.
  const readJson = async (req: IncomingMessage, res: ServerResponse): Promise<unknown> => {
    if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') { error(res, 415, 'INVALID_REQUEST', 'Use application/json'); return undefined; }
    let bytes = 0; const chunks: Buffer[] = [];
    for await (const chunk of req) {
      bytes += Buffer.byteLength(chunk);
      if (bytes > maxBodyBytes) { error(res, 413, 'TOO_LARGE', 'Request exceeds 4096 bytes'); return undefined; }
      chunks.push(Buffer.from(chunk));
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { error(res, 400, 'INVALID_REQUEST', 'Malformed JSON'); return undefined; }
  };
  return createServer(async (req, res) => {
    try {
      const origin = req.headers.origin;
      if (origin && !allowedOrigins.has(origin)) { error(res, 403, 'FORBIDDEN', 'Origin is not configured for this local foundation'); return; }
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
      }
      if (req.method === 'OPTIONS') {
        res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }); res.end(); return;
      }
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (req.method === 'GET' && url.pathname === '/health') { json(res, 200, { status: 'ok', mode: 'local-demo', stage: 'foundation', productionAuthorization: false }); return; }
      if (req.method === 'GET' && url.pathname === '/api/demo') {
        json(res, 200, { mode: 'local-demo', providers: providerStatuses, scenarios: scenarioCatalog, personas: ['child', 'teen', 'adult'] }); return;
      }
      if (req.method === 'POST' && url.pathname === '/api/demo/assessments') {
        if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') { error(res, 415, 'INVALID_REQUEST', 'Use application/json'); return; }
        let bytes = 0;
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          bytes += Buffer.byteLength(chunk);
          if (bytes > maxBodyBytes) { error(res, 413, 'TOO_LARGE', 'Demo request exceeds 4096 bytes'); return; }
          chunks.push(Buffer.from(chunk));
        }
        let input: unknown;
        try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { error(res, 400, 'INVALID_REQUEST', 'Malformed JSON'); return; }
        const parsed = demoRequestSchema.safeParse(input);
        if (!parsed.success) { error(res, 400, 'INVALID_REQUEST', 'Choose a demo persona, P01/P16 fixture and supported variant; extra authority fields are not accepted'); return; }
        json(res, 200, renderDemo(parsed.data)); return;
      }
      // k-ID: the browser hands over the one-time claim token from <KidSessionProvider onClaim>.
      // k-ID's public API docs don't document how to redeem it yet, so we accept it, don't store
      // or log it, and report the blocker honestly instead of calling an invented endpoint.
      if (req.method === 'POST' && url.pathname === '/api/kid/claim') {
        const body = await readJson(req, res); if (body === undefined) return;
        const token = (body as { claimToken?: unknown })?.claimToken;
        if (typeof token !== 'string' || token.length < 8 || token.length > 2048 || Object.keys(body as object).length !== 1) { error(res, 400, 'INVALID_REQUEST', 'Send exactly { claimToken } as a string'); return; }
        json(res, 202, { received: true, redeemed: false, status: 'blocked', reason: 'k-ID claim redemption endpoint not documented; confirm with the k-ID mentor (W02)' }); return;
      }
      // k-ID: read a session server-side with the secret key (documented GET /api/v1/session/get),
      // so features are decided from k-ID's answer, not from anything the browser says.
      if (req.method === 'POST' && url.pathname === '/api/kid/session') {
        const body = await readJson(req, res); if (body === undefined) return;
        const sessionId = (body as { sessionId?: unknown })?.sessionId;
        if (typeof sessionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(sessionId) || Object.keys(body as object).length !== 1) { error(res, 400, 'INVALID_REQUEST', 'Send exactly { sessionId } as a UUID'); return; }
        if (!kid.apiKey) { json(res, 503, { configured: false, status: 'not configured', reason: 'KID_API_KEY is not set on the server' }); return; }
        const signal = AbortSignal.timeout(10_000);
        let upstream: Response;
        try { upstream = await kid.fetch(`${kid.baseUrl}/api/v1/session/get?sessionId=${encodeURIComponent(sessionId)}`, { headers: { Authorization: `Bearer ${kid.apiKey}`, Accept: 'application/json' }, signal }); }
        catch { json(res, 502, { configured: true, status: 'provider error', reason: 'k-ID could not be reached' }); return; }
        if (!upstream.ok) { json(res, 502, { configured: true, status: 'provider error', reason: `k-ID returned ${upstream.status}` }); return; }
        const session = kidSessionSchema.safeParse(await upstream.json().catch(() => null));
        if (!session.success) { json(res, 502, { configured: true, status: 'provider error', reason: 'Unexpected k-ID session shape' }); return; }
        json(res, 200, { configured: true, provenance: kid.baseUrl.includes('.test.') ? 'k-ID test' : 'k-ID live', ...session.data }); return;
      }
      if (req.method === 'GET' && /^\/fixtures\/(P01|P16)$/.test(url.pathname)) {
        const id = url.pathname.split('/')[2];
        const variant = url.searchParams.get('variant') ?? 'baseline';
        const fixture = baselineFixtures.find(f => f.id === id && f.variant === variant);
        if (!fixture) { error(res, 404, 'NOT_FOUND', 'Fixture variant not found'); return; }
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        });
        res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(fixture.id)} synthetic fixture</title><style>body{font:18px/1.6 system-ui;max-width:48rem;margin:3rem auto;padding:1rem;background:#f4f5ed;color:#182d28}article{background:white;padding:2rem;border:1px solid #cad6cf;border-radius:20px}code{overflow-wrap:anywhere}a{color:#075747}button{padding:.8rem}</style><body><p>OZONE LAYER · LOCAL DEMO · ${escapeHtml(fixture.id)}</p><article><h1>${escapeHtml(fixture.title)}</h1><p>${escapeHtml(fixture.text)}</p><p><strong>Illustrative address metadata (not the actual tab URL):</strong><br><code>${escapeHtml(fixture.illustrativeUrl)}</code></p><p>The actual URL is this local page's address in your browser. No domain mapping is configured.</p><button disabled>No credentials collected — fixture only</button><p>Automatic detection is not implemented. The extension can demonstrate manual page access only.</p><a href="${companionOrigin}">Open the Ozone Layer companion</a></article></body></html>`); return;
      }
      error(res, 404, 'NOT_FOUND', 'This foundation exposes health, public demo fixtures and demo assessments only');
    } catch {
      // Do not log request bodies, excerpts, raw error payloads or configuration.
      if (!res.headersSent) error(res, 500, 'INTERNAL', 'The local foundation request could not complete');
      else res.end();
    }
  });
}
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!); }
