import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { demoRequestSchema, coachingRequestSchema, contextUpdateSchema, onboardingRequestSchema, ownedAssessmentRequestSchema, quizAnswerRequestSchema, quizRequestSchema, refreshRequestSchema, speechRequestSchema, structuredErrorSchema } from '@beacon/contracts';
import { z } from 'zod';
import { BackendService } from './backend.js';
import { BackendError } from './errors.js';
import { baselineFixtures, providerStatuses, renderDemo, scenarioCatalog } from '@beacon/fixtures';

const maxBodyBytes = 4096;
export interface ServerOptions { companionOrigin?: string; extensionOrigins?: string[]; backend?: BackendService; audit?: (event: { requestId: string; stage: string; statusCode: number; durationMs: number }) => void }
function localOrigin(input: string): string {
  const url = new URL(input);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.origin !== input) throw new Error('Companion origin must be an exact loopback HTTP origin');
  return url.origin;
}
export function createApp(options: ServerOptions = {}) {
  const backend = options.backend ?? new BackendService();
  const companionOrigin = localOrigin(options.companionOrigin ?? 'http://127.0.0.1:5173');
  const extensions = options.extensionOrigins ?? [];
  if (extensions.some(origin => !/^chrome-extension:\/\/[a-p]{32}$/.test(origin))) throw new Error('Invalid extension origin configuration');
  const allowedOrigins = new Set([companionOrigin, ...extensions]);
  const json = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(body));
  };
  const error = (res: ServerResponse, status: number, code: z.infer<typeof structuredErrorSchema>['code'], message: string, retryable = false) => json(res, status, structuredErrorSchema.parse({ code, message, retryable, requestId: String(res.getHeader('X-Request-ID') ?? randomUUID()) }));
  const app = createServer(async (req, res) => {
    const requestId = randomUUID(); const started = performance.now(); let stage = 'request';
    const disconnected = new AbortController();
    const cancel = () => disconnected.abort();
    req.once('aborted', cancel);
    const cancelUndelivered = () => { if (!res.writableEnded) cancel(); };
    res.once('close', cancelUndelivered);
    res.once('finish', () => { req.removeListener('aborted', cancel); res.removeListener('close', cancelUndelivered); });
    res.setHeader('X-Request-ID', requestId);
    res.once('finish', () => options.audit?.({ requestId, stage, statusCode: res.statusCode, durationMs: Math.round(performance.now() - started) }));
    try {
      const origin = req.headers.origin;
      if (origin && !allowedOrigins.has(origin)) { error(res, 403, 'FORBIDDEN', 'Origin is not configured for this local foundation'); return; }
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
      }
      if (req.method === 'OPTIONS') {
        res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }); res.end(); return;
      }
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (req.method === 'GET' && url.pathname === '/health') { json(res, 200, { status: 'ok', mode: 'local-demo', stage: 'foundation', productionAuthorization: false }); return; }
      if (req.method === 'GET' && url.pathname === '/api/demo') {
        json(res, 200, { mode: 'local-demo', providers: providerStatuses, scenarios: scenarioCatalog, personas: ['child', 'teen', 'adult'] }); return;
      }
      if (req.method === 'POST' && url.pathname === '/api/demo/assessments') {
        stage = 'public-demo';
        const input = await readJson(req);
        const parsed = demoRequestSchema.safeParse(input);
        if (!parsed.success) { error(res, 400, 'INVALID_REQUEST', 'Choose a demo persona, P01/P16 fixture and supported variant; extra authority fields are not accepted'); return; }
        json(res, 200, renderDemo(parsed.data)); return;
      }
      if (req.method === 'POST' && url.pathname === '/api/onboarding/session') {
        stage = 'onboarding';
        const body = onboardingRequestSchema.parse(await readJson(req));
        json(res, 201, await backend.start(body)); return;
      }
      // Preserve the widget's honest redemption blocker. This never grants an
      // application session or accepts a browser session ID as authorization.
      if (req.method === 'POST' && url.pathname === '/api/kid/claim') {
        stage = 'kid-claim';
        z.object({ claimToken: z.string().min(8).max(2048) }).strict().parse(await readJson(req));
        json(res, 202, { received: true, redeemed: false, status: 'blocked', reason: 'k-ID claim redemption and owned-session binding are unverified. The widget cannot authorize application operations.' }); return;
      }
      const quizAttempt = /^\/api\/challenges\/([a-z0-9-]{1,60})\/attempts$/.exec(url.pathname);
      const voiceRoute = /^\/api\/voice\/turns\/([a-f0-9-]{36})(?:\/(cancel))?$/.exec(url.pathname);
      const learningRoute = /^\/api\/learning\/([a-z0-9-]{1,60})\/(issue|reveal)$/.exec(url.pathname);
      const budgetRoute = /^\/api\/family-budget\/requests\/([a-f0-9-]{36})\/(cancel|simulate)$/.exec(url.pathname);
      const privateRoutes = ['/api/onboarding/context', '/api/onboarding/refresh', '/api/onboarding/logout', '/api/capabilities', '/api/assessments', '/api/coaching/messages', '/api/coaching/questions', '/api/voice/speech', '/api/providers', '/api/challenges', '/api/kid/session', '/api/handoffs', '/api/handoffs/redeem', '/api/voice/turns', '/api/progress', '/api/progress/identity', '/api/progress/reset', '/api/learning', '/api/learning/attempts', '/api/purchases', '/api/purchase-policy'];
      if (privateRoutes.includes(url.pathname) || quizAttempt || voiceRoute || learningRoute || budgetRoute || ['/api/family-budget', '/api/family-budget/requests', '/api/family-budget/reset'].includes(url.pathname)) {
        stage = url.pathname === '/api/coaching/messages' ? 'coaching' : url.pathname === '/api/voice/speech' ? 'speech' : quizAttempt || url.pathname === '/api/challenges' ? 'practice' : url.pathname === '/api/assessments' ? 'owned-assessment' : 'session';
        const credential = bearer(req);
        // Authenticate before accepting a private body, even without an Origin header.
        backend.capabilities(credential);
        if (req.method === 'GET' && url.pathname === '/api/family-budget') { json(res, 200, backend.familyBudget(credential)); return; }
        if (req.method === 'GET' && url.pathname === '/api/progress') { json(res, 200, backend.progress(credential)); return; }
        if (req.method === 'GET' && url.pathname === '/api/learning') { json(res, 200, backend.learningCatalog(credential)); return; }
        if (req.method === 'GET' && url.pathname === '/api/purchase-policy') { json(res, 200, { rule: 'off', parentLink: 'unverified', savedMethod: 'unverified', childPurchaseFlow: 'blocked', detail: 'W14 parent policy, purchase approval and saved-method charging remain prerequisites. Basic lessons and badges are free.' }); return; }
        if (req.method === 'GET' && url.pathname === '/api/capabilities') { json(res, 200, backend.capabilities(credential)); return; }
        if (req.method === 'GET' && url.pathname === '/api/providers') { json(res, 200, backend.providers(credential)); return; }
        if (req.method === 'GET' && url.pathname === '/api/challenges') {
          const query = Object.fromEntries(url.searchParams);
          const request = quizRequestSchema.parse({ ...query, contextVersion: Number(query.contextVersion) });
          json(res, 200, backend.quiz(credential, request)); return;
        }
        if (req.method === 'POST') {
          const body = await readJson(req, voiceRoute && !voiceRoute[2] ? 2800000 : maxBodyBytes);
          if (url.pathname === '/api/family-budget/requests') { json(res, 200, backend.requestFamilyBudget(credential, body)); return; }
          if (url.pathname === '/api/family-budget/reset') { json(res, 200, backend.resetFamilyBudget(credential, body)); return; }
          if (budgetRoute) { json(res, 200, backend.transitionFamilyBudget(credential, budgetRoute[1], body, budgetRoute[2] === 'cancel')); return; }
          if (url.pathname === '/api/handoffs') { json(res, 201, backend.createHandoff(credential, body)); return; }
          if (url.pathname === '/api/handoffs/redeem') { json(res, 201, backend.redeemHandoff(credential, body)); return; }
          if (url.pathname === '/api/progress/identity') { const input = z.object({ token: z.string().optional() }).strict().parse(body); json(res, 200, backend.progressIdentity(credential, input.token)); return; }
          if (url.pathname === '/api/progress/reset') { z.object({}).strict().parse(body); json(res, 200, backend.progressReset(credential)); return; }
          if (learningRoute) {
            z.object({}).strict().parse(body);
            json(res, 200, learningRoute[2] === 'issue' ? backend.learningIssue(credential, learningRoute[1]) : backend.learningReveal(credential, z.uuid().parse(learningRoute[1]))); return;
          }
          if (url.pathname === '/api/learning/attempts') { json(res, 200, backend.learningSubmit(credential, body)); return; }
          if (url.pathname === '/api/purchases') { stage = 'purchase'; json(res, 200, await backend.purchase(credential, body, disconnected.signal)); return; }
          if (url.pathname === '/api/voice/turns') { stage = 'voice-ready'; json(res, 201, await backend.beginVoice(credential, body, disconnected.signal)); return; }
          if (voiceRoute) {
            stage = voiceRoute[2] ? 'voice-cancel' : 'voice-process';
            if (voiceRoute[2]) z.object({}).strict().parse(body);
            json(res, 200, voiceRoute[2] ? backend.cancelVoice(credential, voiceRoute[1]) : await backend.voice(credential, voiceRoute[1], body, disconnected.signal)); return;
          }
          // Widget session reads use only the server-bound W02 reference.
          // Arbitrary browser-supplied vendor IDs are deliberately rejected.
          if (url.pathname === '/api/kid/session') { const request = refreshRequestSchema.parse(body); json(res, 200, await backend.refresh(credential, request.contextVersion)); return; }
          if (url.pathname === '/api/onboarding/context') { json(res, 200, await backend.updateContext(credential, contextUpdateSchema.parse(body))); return; }
          if (url.pathname === '/api/onboarding/refresh') { const request = refreshRequestSchema.parse(body); json(res, 200, await backend.refresh(credential, request.contextVersion)); return; }
          if (url.pathname === '/api/onboarding/logout') { z.object({}).strict().parse(body); json(res, 200, backend.logout(credential)); return; }
          if (url.pathname === '/api/assessments') { json(res, 201, backend.createAssessment(credential, ownedAssessmentRequestSchema.parse(body))); return; }
          if (url.pathname === '/api/coaching/questions') { json(res, 200, await backend.ask(credential, body, disconnected.signal)); return; }
          if (url.pathname === '/api/coaching/messages') { json(res, 200, await backend.explain(credential, coachingRequestSchema.parse(body), disconnected.signal)); return; }
          if (url.pathname === '/api/voice/speech') { json(res, 200, await backend.speak(credential, speechRequestSchema.parse(body), disconnected.signal)); return; }
          if (quizAttempt) { json(res, 200, backend.answerQuiz(credential, quizAttempt[1], quizAnswerRequestSchema.parse(body))); return; }
        }
      }
      if (req.method === 'GET' && /^\/fixtures\/(P01|P10|P16)$/.test(url.pathname)) {
        const id = url.pathname.split('/')[2];
        const variant = url.searchParams.get('variant') ?? 'baseline';
        const fixture = baselineFixtures.find(f => f.id === id && f.variant === variant);
        if (!fixture) { error(res, 404, 'NOT_FOUND', 'Fixture variant not found'); return; }
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        });
        res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ozone Layer · ${escapeHtml(fixture.id)} synthetic fixture</title><style>body{font:18px/1.6 system-ui;max-width:48rem;margin:3rem auto;padding:1rem;background:#f4f5ed;color:#182d28}article{background:white;padding:2rem;border:1px solid #cad6cf;border-radius:20px}code{overflow-wrap:anywhere}a{color:#075747}button{padding:.8rem}</style><body><p>Ozone Layer · LOCAL DEMO · ${escapeHtml(fixture.id)}</p><article data-ozone-fixture="${escapeHtml(fixture.id)}" data-variant="${escapeHtml(fixture.variant)}"><h1>${escapeHtml(fixture.title)}</h1><p data-fixture-text>${escapeHtml(fixture.text)}</p><p><strong>Illustrative address metadata (not the actual tab URL):</strong><br><mark data-fixture-destination>${escapeHtml(fixture.illustrativeUrl)}</mark></p><p>The actual URL is this local page's address in your browser. No domain mapping is configured.</p>${fixture.id === 'P01' && fixture.variant === 'baseline' ? '<p role="note"><strong>Warning: this fictional offer asks for secrecy and a verification payment. Stay here and check with a trusted adult.</strong></p><a data-fixture-risky href="/fixtures/P01?variant=baseline#verification-pack">Open verification-pack link</a>' : ''}<button disabled>No credentials collected — fixture only</button><p>Use the extension toolbar to check this controlled fixture. Only the explicitly supported local fixtures are recognized; this is not general email or game surveillance.</p><a href="${companionOrigin}/?fixture=${escapeHtml(fixture.id)}&variant=${escapeHtml(fixture.variant)}">Open the Ozone Layer companion</a></article></body></html>`); return;
      }
      error(res, 404, 'NOT_FOUND', 'This route is not available in the local Ozone Layer backend.');
    } catch (cause) {
      if (!res.headersSent && cause instanceof BackendError) { error(res, cause.status, cause.code, cause.message, cause.retryable); return; }
      if (!res.headersSent && cause instanceof z.ZodError) { error(res, 400, 'INVALID_REQUEST', 'Request does not match the supported schema. Extra authority fields are forbidden.'); return; }
      // Do not log request bodies, excerpts, raw error payloads or configuration.
      if (!res.headersSent) error(res, 500, 'INTERNAL', 'The local foundation request could not complete');
      else res.end();
    }
  });
  app.on('close', () => backend.close());
  return app;
}
async function readJson(req: IncomingMessage, limit = maxBodyBytes): Promise<unknown> {
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw new BackendError(415, 'INVALID_REQUEST', 'Use application/json');
  let size = 0; const chunks: Buffer[] = [];
  for await (const chunk of req) { size += Buffer.byteLength(chunk); if (size > limit) throw new BackendError(413, 'TOO_LARGE', 'Request exceeds the supported body limit'); chunks.push(Buffer.from(chunk)); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new BackendError(400, 'INVALID_REQUEST', 'Malformed JSON'); }
}
function bearer(req: IncomingMessage): string {
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization ?? '');
  if (!match) throw new BackendError(401, 'UNAUTHORIZED', 'A valid application bearer credential is required.');
  return match[1];
}
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!); }
