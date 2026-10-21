# Ozone Layer backend: W02 sessions, local teaching and provider handoff

The current demo increment and verification supersede earlier baseline counts/status below. See [DEMO.md](DEMO.md) and the additive routes at the end of this document. Existing W02 ownership and authorization behavior is preserved.

Scope: the existing W02 authentication, owned fixture references, k-ID CDK Test Mode adapter and protected-operation boundary, extended with authenticated P01/P16 scripted explanations, short server-checked practice, and Gemini/Inworld REST adapters. The public W00/W01 demo remains anonymous and unchanged. Modulate, billing, live detection, mastery awards and UI onboarding are still outside this increment. The integration companion now consumes these authenticated offline routes; the original public preview endpoints remain available.

## Actual status and blockers

The local backend works without vendor keys: it issues application credentials, creates private synthetic fixture references, exposes normalized capability state, and invalidates/logout sessions. In `provider-test` mode without k-ID configuration, creation succeeds with a credential and `onboardingState: unavailable`; explicit refresh returns sanitized `503 UNAVAILABLE`. No old approval permits execution after refresh failure.

Gemini has passed the standalone live connectivity diagnostic below; the authenticated application/provider chain remains **not live verified**. The CDK and Inworld integrations remain unverified. Missing settings yield explicit **not configured** runtime status through authenticated `GET /api/providers`; configured application adapters report **implemented but unverified**, never live verified from configuration or a standalone diagnostic alone. Injected test transports report **mock**. The event team must confirm its k-ID workflow/product and AI permission mapping, and exercise a genuine permitted/denied test-session pair. No hosted verification, legal compliance, webhook or production identity assurance is claimed. Inworld and Modulate remain not configured; FastSpring remains deferred.

## Live Gemini connectivity diagnostic — 2026-10-21

The root server configuration was inspected without displaying credentials. `GEMINI_API_KEY` was present, while the existing `GEMINI_MODEL` value was invalid for this adapter. Authenticated [model listing and model metadata](https://ai.google.dev/api/models) returned HTTP 200 and advertised `generateContent` support. A first small request to listed `gemini-2.5-flash-lite` returned HTTP 404; catalogue visibility alone therefore did not establish working generation. One bounded retry with **`gemini-3.5-flash-lite`** returned HTTP **200** with one **STOP** candidate.

The successful request used only fixed fictional classroom/game-password text, the existing explanation fields, `generationConfig.responseFormat.text` JSON schema and `x-goog-api-key`. Response-envelope/JSON parsing, the shared `explanationReplySchema`, exact diagnostic assessment/evidence references, and `spokenText === explanation` all passed. This verified authentication, generation access for that model and structured response parsing. No raw vendor output, key, application credential or private user content was printed or retained as evidence. There were **two generation attempts total: one failed, one successful**, in addition to model discovery/metadata reads.

Only `GEMINI_MODEL` in the gitignored root `.env` was changed, to `gemini-3.5-flash-lite`; every other parsed environment value was checked unchanged. Restart the API via `npm run dev` to load the setting, or explicitly load root `.env` when starting the API directly. The earlier offline command deliberately does not load it.

This was a direct, server-side vendor diagnostic, separate from application authorization: no `ProviderContext`, fake permission adapter, k-ID approval, opt-in override or authorization shortcut was created. **The live authenticated P01/P16 coaching route was not exercised.** Local k-ID fields are populated but not verified, and `KID_AI_MAPPING_CONFIRMED` remains **false**; no genuine authorized application session was available. Do not flip that flag merely to run a test. Confirm the real product mapping/workflow and permitted Test Mode session first.

With the actual local configuration, both P01 and P16 offline HTTP flows (assessment → scripted explanation → quiz → server feedback → logout) passed without provider execution. Runtime Gemini status correctly remains **implemented but unverified** for the application integration. Inworld runtime status and the Modulate catalog status remain **not configured**. No k-ID, Inworld or Modulate request was made during this diagnostic.

Still required: verified k-ID Test Mode credentials/product/workflow, confirmation of the actual AI mapping, genuine permitted/denied/revoked sessions and protected P01/P16 route checks; `INWORLD_API_KEY`, `INWORLD_MODEL_ID`, `INWORLD_VOICE_ID`; and `MODULATE_API_KEY` plus the future W08 redaction implementation. Gemini key/model connectivity is verified only; full-route permission/cancellation behavior, model quality/injection checks and account retention policy still require live verification. No runtime permission checks were changed.

## Session lifetime and ownership

- `POST /api/onboarding/session` issues a 256-bit random opaque bearer credential once, and an independent random owner ID. Only the SHA-256 credential hash is retained. Neither the public `demo:child` label nor a k-ID reference authenticates an Ozone Layer request.
- Application sessions have a fixed **30-minute** lifetime and no sliding renewal. This is Ozone Layer's policy, not a k-ID expiry. Store capacity is **1,000 sessions**; expired entries are pruned on access. Restart/signout invalidates credentials and in-memory state. Capacity exhaustion returns `429 LIMITED`.
- Each session holds at most **32 fixture references**, expiring after **five minutes** or earlier with its session. References are opaque UUIDs, bound to owner and context version. No private read accepts a caller's owner or trusted assessment object. Cross-owner references return generic `404` without disclosing existence.
- All private requests need `Authorization: Bearer <application-credential>`, including local tools without an Origin header. Never put credentials in navigation URLs or logs. Response bodies use `Cache-Control: no-store`.
- Production mode is disabled. Public local-demo switches cannot promote themselves. A provider-test application session alone is not a permission grant; actual server-resolved vendor decisions, configured mapping and user opt-ins are independently required.

## Routes and shared schemas

Base URL: `http://127.0.0.1:8787` (or use the existing companion `/api` proxy). Bodies require JSON and are capped at 4,096 bytes. Unknown fields are rejected. `onboardingRequestSchema`, `contextUpdateSchema`, `refreshRequestSchema`, `ownedAssessmentRequestSchema` and `sessionViewSchema` are exported from `@beacon/contracts`.

| Route | Authentication / request | Result |
| --- | --- | --- |
| `POST /api/onboarding/session` | Public; start body below | `201`, credential plus session view; unavailable onboarding is explicitly labeled |
| `GET /api/capabilities` | Bearer; no body | Current session view/cached snapshot and readable reasons; the snapshot is informational, not a dispatch authorization |
| `POST /api/onboarding/context` | Bearer; `contextVersion` and `optIns`, `jurisdiction`, and/or `syntheticProfile` | Updated session view. Profile/jurisdiction correction restarts server onboarding, never edits grants |
| `POST /api/onboarding/refresh` | Bearer; `{"contextVersion": 1}` using the actual current version | Session view plus `changed`; polls only the bound vendor session/challenge. No link yields `503 UNAVAILABLE` |
| `POST /api/onboarding/logout` | Bearer; `{}` | `{"signedOut":true}`; cancels work and invalidates the credential |
| `POST /api/assessments` | Bearer; `contextVersion`, `fixtureId: P01/P16`, `variant: baseline/safe/ambiguous` | `201`, owned `assessment`, `referenceExpiresAt`, fixture metadata and public challenge |
| `GET /api/providers` | Bearer; no body | Runtime k-ID/Gemini/Inworld configuration status; contains no keys and grants no permissions |
| `POST /api/coaching/messages` | Bearer; `assessmentId`, `contextVersion` | Scripted explanation in local-demo; protected Gemini request in provider-test. Returns opaque `explanationId`, `mode`, `source`, `notice`, `reply`, `contextVersion` |
| `GET /api/challenges?assessmentId=<id>&contextVersion=<version>` | Bearer; owned local-demo assessment after explanation | One curated public question, without answer key; returns `409` if explanation has not been requested |
| `POST /api/challenges/:id/attempts` | Bearer; `assessmentId`, `contextVersion`, quiz `version`, `choiceId` | Server-checked correctness and teaching feedback, always `masteryCreditAwarded: false`; must load the owned quiz first |
| `POST /api/voice/speech` | Bearer; `assessmentId`, `contextVersion`, `explanationId` | Protected Inworld MP3 as `audioBase64`, `mimeType`, matching `captions`, mode/source/notice. Never accepts caller text or audio |

```json
{
  "mode": "provider-test",
  "syntheticProfile": "adult",
  "jurisdiction": "US-CA",
  "optIns": { "cloudAnalysis": false, "spokenCoaching": false, "memory": false }
}
```

Use `mode: local-demo` for an authenticated offline fixture session; it never calls k-ID and cannot dispatch providers. Only three server-defined synthetic profiles are accepted; there is no real-DOB, email, uploaded-document or arbitrary age input. Jurisdiction input is synthetic test context, not a verified location. Stored sessions retain the profile ID and jurisdiction, not DOB. Test samples are fictional, not legal age thresholds.

Example requests (replace placeholders locally; do not paste credentials into chat):

```bash
curl -sS http://127.0.0.1:8787/api/onboarding/session \
  -H 'Content-Type: application/json' \
  -d '{"mode":"local-demo","syntheticProfile":"adult","jurisdiction":"US-CA","optIns":{"cloudAnalysis":false,"spokenCoaching":false,"memory":false}}'

curl -sS http://127.0.0.1:8787/api/capabilities \
  -H 'Authorization: Bearer <application-credential>'

curl -sS http://127.0.0.1:8787/api/assessments \
  -H 'Authorization: Bearer <application-credential>' \
  -H 'Content-Type: application/json' \
  -d '{"contextVersion":1,"fixtureId":"P01","variant":"baseline"}'

curl -sS http://127.0.0.1:8787/api/onboarding/logout \
  -H 'Authorization: Bearer <application-credential>' \
  -H 'Content-Type: application/json' -d '{}'
```

The issued response contains `credential` only on creation. Other fields are `ownerId`, `mode`, `contextVersion`, `syntheticProfile`, `jurisdiction`, `optIns`, `applicationExpiresAt`, `onboardingState`, `capabilities`, `authorizationFreshness` and runtime `provider`. An outstanding challenge additionally returns its type/hosted URL with a Test Mode label; its ID/session association stays server-owned. Versions can increment during onboarding, refresh and correction; always use the returned version rather than assuming `1` for provider-test sessions.

Status/error distinctions: `401 UNAUTHORIZED` for credentials, `403 FORBIDDEN` for unmet policy, `404 NOT_FOUND` for unavailable owned references, `409 CONFLICT` for stale context or simultaneous transitions, `429 LIMITED` for bounded stores, and retryable `503 UNAVAILABLE` for failed vendor validation. Errors have sanitized `code/message/retryable/requestId`; malformed JSON/schema failures are `400` and oversized bodies `413`. CORS allows only configured origins with Authorization and Content-Type preflight; allowlisting an origin never authenticates it.

## Exact offline P01/P16 teaching flow

Start the backend without loading any `.env` file or requiring vendor configuration:

```bash
node --import tsx apps/api/src/main.ts
```

In another terminal, run this complete request sequence. It retains the application credential only in local process memory, uses returned IDs/versions, prints no credential, and logs out when finished. The first quiz option is deliberately just an example selection; the server determines correctness.

```bash
node --input-type=module <<'JS'
const base = 'http://127.0.0.1:8787';
async function request(path, body, credential) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${result.code}: ${result.message}`);
  return result;
}
const session = await request('/api/onboarding/session', {
  mode: 'local-demo', syntheticProfile: 'child', jurisdiction: 'US-CA',
  optIns: { cloudAnalysis: false, spokenCoaching: false, memory: false },
});
const { credential, contextVersion } = session;
try {
  console.log(await request('/api/providers', undefined, credential));
  for (const fixtureId of ['P01', 'P16']) {
    const { assessment } = await request('/api/assessments', {
      contextVersion, fixtureId, variant: 'baseline',
    }, credential);
    const owned = { assessmentId: assessment.id, contextVersion };
    const explanation = await request('/api/coaching/messages', owned, credential);
    console.log(fixtureId, explanation.source, explanation.notice, explanation.reply);
    const { challenge } = await request(
      `/api/challenges?assessmentId=${encodeURIComponent(assessment.id)}&contextVersion=${contextVersion}`,
      undefined, credential,
    );
    console.log(challenge.question, challenge.choices);
    console.log(await request(`/api/challenges/${challenge.id}/attempts`, {
      ...owned, version: challenge.version, choiceId: challenge.choices[0].id,
    }, credential));
  }
} finally {
  await request('/api/onboarding/logout', {}, credential);
}
JS
```

Change `syntheticProfile` to `teen` or `adult`, and `variant` to `safe` or `ambiguous`, to exercise the same flow. All 18 combinations are covered by automated tests. P01 practices checking the address and actual request; P16 practices distinguishing educational context from an actual request. The local-demo notice explicitly disclaims real k-ID verification, Gemini reasoning and generated vendor speech. No vendor is called even if its environment settings happen to exist. Local practice does not require cloud/voice opt-ins and never treats local capabilities as provider authorization.

Answer keys and teaching rubrics live only in `@beacon/fixtures/server`. The quiz response contains choices, no answer flags. Attempts reject client `correct`, owner/grant/mode fields, unknown choices, a mismatched question/version, cross-owner references, expired references and stale contexts. Teaching state is bounded by the existing assessment's five-minute reference and session lifetime. Repeated attempts are unscored practice; independent attempts, persistence, transactional awards, badges and mastery/idempotency rules remain W09 work.

## Frontend contract handoff

New exports from `@beacon/contracts` are additive: `coachingRequestSchema`, `coachingResponseSchema`, `quizRequestSchema`, `quizResponseSchema`, `quizAnswerRequestSchema`, `quizFeedbackSchema`, `speechRequestSchema`, `speechResponseSchema` and `providerListSchema`. Existing W02 schemas and the public demo payload are unchanged. This short unscored quiz uses `quizAnswerRequestSchema`, not the existing full mastery `attemptSchema`; do not add client reveal/independence/credit authority to it.

Frontend consumers can integrate the exact sequence above using their existing bearer session and returned context version. Render `mode`, `source`, `notice` and provider state; the existing public `/api/demo` catalog is static demo information, while `/api/providers` reports runtime configuration. After `409`, reload capabilities and create a fresh owned assessment; do not reuse an old explanation/quiz. After `401`, create a new application session. Use a separate local-demo session for explicit offline practice; a failed provider-test request never silently switches to a scripted answer. Retain valid explanation text when speech fails. The integration companion consumes these contracts through `apps/companion/src/learning.ts`, including the additive `ownedAssessmentResponseSchema`. It keeps credentials only in memory, checks owner/context consistency, cancels stale requests and logs out on navigation between lessons. Backend/frontend consumer review of the combined branch remains required; the extension still has no backend assessment connection.

For speech, post only `{assessmentId, contextVersion, explanationId}` from a current Gemini explanation. The server looks up the exact saved text. Play the returned `audioBase64` as `audio/mpeg` with the returned captions only after explicit playback intent. Abort the HTTP request on Stop/navigation, discard responses when local context changes, and clear audio/object URLs. The server aborts provider work on HTTP disconnect, but client playback controls and stopping already-delivered audio remain frontend work. No microphone, recording, streaming audio or arbitrary TTS proxy is exposed.

## Gemini and Inworld adapters (automated verification uses simulated HTTP)

Official references reviewed on **2026-10-21**: [Gemini generateContent REST reference](https://ai.google.dev/api/generate-content), [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/generate-content/structured-output), and [Inworld non-streaming speech reference](https://docs.inworld.ai/api-reference/ttsAPI/texttospeech/synthesize-speech). Documentation review and simulated tests establish no real vendor connection; the separate live Gemini diagnostic is recorded above.

`GeminiAdapter` posts to the fixed `https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent` endpoint with `x-goog-api-key`. The request uses `systemInstruction`, an untrusted-data `contents` envelope, one candidate and `generationConfig.responseFormat.text` with `mimeType: APPLICATION_JSON` and a JSON schema. Current REST documentation recommends `responseFormat`; older `responseSchema` examples are not used. There are no tools, URL fetches or chat-memory calls. Successful parsing requires one STOP candidate, no block/filter result, textual JSON, the owned assessment/known unique evidence IDs and exact `spokenText === explanation`. Thought/tool parts, foreign IDs, truncated or malformed output are unavailable results. Schema validation establishes structure/ownership, not factual accuracy; actual model quality/injection behavior remains live verification work.

`InworldAdapter` posts to fixed `https://api.inworld.ai/tts/v1/voice` with `Authorization: Basic <INWORLD_API_KEY>` using the portal's Base64 credential as supplied. It sends the saved explanation, explicit `modelId`/`voiceId` and `audioConfig.audioEncoding: MP3`. It parses the unary JSON `audioContent` field directly, not a streaming `result` wrapper. Input is capped at 2,000 UTF-16 code units. Audio must be nonempty canonical Base64 and at most 1 MiB decoded. Simulated audio bytes test transport handling only; real MP3 decoding, audible content and caption alignment are unverified.

Both adapters reject redirects, cap response bytes (Gemini 64 KiB; Inworld JSON 2 MiB), and impose 10-second deadlines across headers/body even for simulated transports that ignore abort. Provider authentication errors, invalid output and rate/network/upstream failures return sanitized `503 UNAVAILABLE`. `retryable` is false for missing configuration, authentication, unsupported shape/size and rejected requests; true for cancellation/timeouts, rate limits, network/JSON transport failure and upstream 5xx/408. Raw vendor bodies, keys, evidence and audio are not logged. There is no automatic retry or silent vendor-to-demo fallback.

Actual reasoning and speech dispatches run through the unchanged W02 `withAuthorizedOperation` boundary and its 20-second operation deadline. Adapters and stages call `context.assertCurrent()`; final delivery rechecks permission, ownership, assessment expiry and context. Speech also checks that its saved explanation was not replaced during synthesis or final permission refresh. Real transports require `executionMode: provider-test`; injected HTTP simulations require `test-fake`. Backend construction requires explicit `allowTestAdapter` for injected fakes and refuses fake permissions paired with real Gemini/Inworld transports. Environment variables cannot enable a simulated adapter.

Remaining server-only configuration (all optional at startup; names without credentials are in `.env.example`):

| Name | Required for |
| --- | --- |
| `GEMINI_API_KEY` | Gemini API authentication |
| `GEMINI_MODEL` | Explicit team-accessible model ID supporting the documented structured output request; no model default |
| `INWORLD_API_KEY` | Portal Base64 credential; do not encode it again |
| `INWORLD_MODEL_ID` | Explicit available TTS model ID; no default |
| `INWORLD_VOICE_ID` | Explicit available stock/synthetic voice ID; no default or voice cloning |
| Existing `KID_API_KEY`, `KID_PRODUCT_ID`, `KID_WORKFLOW`, `KID_API_BASE`, `KID_AI_MAPPING_CONFIRMED` | W02 documented Test Mode workflow and product mapping described below |

No credentials, model defaults or provider host overrides were added. `BEACON_*` connection settings and existing package/route identities are preserved. A missing or unsupported model/voice setting keeps the relevant adapter **not configured**. An owned provider-test explanation/speech request then returns explicit non-retryable `503 UNAVAILABLE` naming that provider; it cannot become a local-demo result. If configuration exists but k-ID validation/grants/opt-ins are missing, W02 denies dispatch.

### Still required for live verification

- Confirm k-ID event workflow/product, permitted and denied Test Mode sessions, hosted challenge behavior, configured permission mapping and actual revocation/freshness. No production assurance is implied by synthetic identities.
- Gemini key/model and structured-response connectivity passed the separate diagnostic above. Still verify the protected P01/P16 route with genuine authorization, live blocked/truncated/error behavior, explanation quality and injection resistance. Confirm provider retention/account policy before sending any non-synthetic evidence.
- Supply Inworld credential/model/stock voice access; confirm Basic authentication, unary Base64 MP3 output, audible decode/playback, duration, captions and permission cancellation. Aborting a request does not prove vendor-side processing or metering was stopped.
- Exercise a genuine permitted k-ID → Gemini → Inworld chain and denied/revoked cases through the HTTP routes, recording sanitized mode/date/results. The implementation phase and automated tests used injected simulated HTTP responses only; the subsequent standalone Gemini diagnostic above is the only live generation verification so far.
- Frontend integration/consumer review, explicit Play/Stop/replay/mute/autoplay handling, no stale playback, full W08 redaction/voice input and W09 awards remain separate work.

## k-ID configuration and documented contract

Server-only names in `.env.example`:

| Name | Purpose |
| --- | --- |
| `KID_API_KEY` | Product-scoped Test Mode key; never exposed |
| `KID_PRODUCT_ID` | Existing team product reference; not sent as an invented query field. Cross-product Account System Product headers are outside this standard-product adapter |
| `KID_WORKFLOW` | Set `cdk-test` only after confirming this is the actual event workflow; blank/unknown keeps the adapter unavailable |
| `KID_API_BASE` | Must exactly equal `https://game-api.test.k-id.com/api/v1`; other hosts, production and custom destinations are disabled |
| `KID_AI_MAPPING_CONFIRMED` | Set `true` only after confirming the configured product permissions against the mapping below. This flag grants no user permission |

Do not overwrite `.env`; load it locally and restart `npm run dev`. Requests use Bearer key authentication, fixed route allowlists, redirect rejection, 10-second per-call deadlines and 64-KiB response limits. No SDK or model dependency was added. A configured key is not a verified integration.

The adapter calls the documented [requirements](https://docs.k-id.com/api/endpoints/get-age-gate-requirements) and [age-gate check](https://docs.k-id.com/api/endpoints/check-age-gate) routes using server-defined synthetic data and an approved age collection method. It follows an immediate PASS with an actual [session/get](https://docs.k-id.com/api/endpoints/get-session) read, parsing the API reference's flat session shape. It never trusts a client PASS or vendor reference supplied in request JSON. The quick-start AI illustration has a different wrapper; that wrapper is deliberately not guessed into this adapter.

For a hosted challenge, it retains the bound ID and exact `https://family.k-id.com` URL and returns a labeled pending state. [Server-side polling](https://docs.k-id.com/api/endpoints/get-challenge-status) resolves only that challenge; PASS must be followed by session retrieval, and FAIL stays prohibited. There is no email-sending API, no webhook endpoint and no browser callback that grants approval. A user must use the supported Test Mode simulator/widget without real contact/identity collection; that interaction was not exercised here. OTP renewal/expired-link recovery is not implemented; start a new application session if the hosted test link expires.

Fresh unconditional session reads are used before dispatch/delivery. The documented `etag` is compared when supplied to invalidate a changed context; conditional 304 caching is not used. Vendor response expiry is not invented. If requirements say no age gate should be shown, this adapter reports unavailable: a default-permissions response is not fabricated into a linked session. Account System/Kai, unsupported age methods, permission upgrades and real-world onboarding need separate confirmed contracts. These are explicit live-flow limitations, not successful integrations.

## Capability mapping and Role C seam

Mapping is based on the [documented AI permission catalog](https://docs.k-id.com/get-started/quickstart-guides/ai-products), and must be checked against the configured product before enabling actual dispatch.

| Internal capability | Required source |
| --- | --- |
| `cloud_content_analysis` | Ozone Layer app policy plus explicit cloud-analysis opt-in; never inferred from a vendor flag |
| `ai_coaching` | `ai-chat` |
| `voice_input` | `ai-chat` + `ai-voice-mode` + `ai-media-upload` |
| `voice_output` | `ai-voice-mode` + `ai-media-generation` |
| `uploads` | `ai-media-upload` |
| `conversation_memory` | `ai-memory`, plus memory opt-in when used |
| `permitted_guardian_sharing` | Denied by app policy for this iteration |

All required permissions must be explicitly enabled; a denial wins, missing is unknown, and pending/prohibited/failed validation never becomes approval. Duplicate or contradictory vendor permissions are rejected. Cloud app-policy eligibility may read allowed even when onboarding is unavailable; it cannot override state, missing vendor grants or user consent. Voice operations also require spoken-coaching opt-in. Chrome microphone access and explicit recording intent remain separate future client/voice checks.

Role C must use `BackendService.withAuthorizedOperation(credential, ownedAssessmentId, operation, contextVersion, dispatch, externalSignal?)`, not accept a ProviderContext from JSON. Operations are `coaching`, `speech`, `voice`, `uploads` and `memory`; the voice operation combines both input/output grant sets. The helper re-reads vendor state before dispatch and after completion, enforces ownership/current version/opt-ins, registers a cancellation signal and discards late responses. Call `context.assertCurrent()` between future provider stages. Output providers must speak only their owned validated explanation in W07; this helper is not a public arbitrary-proxy endpoint.

`ProviderContext` adds `executionMode` and async `assertCurrent()` to its prior owner/assessment/capabilities/version/signal fields. Real adapters must require `executionMode: provider-test`; `test-fake` exists only for injected automated-test transports/dispatch spies. Environment configuration cannot select a fake, and BackendService rejects injected fakes unless explicitly constructed for automated tests. `PermissionAdapter` exposes start/refresh/status lifecycle methods, returning only validated vendor facts; ownership and capability construction belong to BackendService. The reasoning/speech/redaction method signatures are unchanged; the configured reasoning/speech providers add runtime status and transport metadata.

Logout, expiry, version changes, revocation and failed refresh invalidate work. The operation wrapper propagates abort signals and checks state again even when a downstream test deliberately ignores abort. Its maximum deadline is 20 seconds, bounded by application expiry and any caller cancellation. There are at most 16 registered operations per session. Context/refresh mutations are serialized; stale/overlapping requests receive 409. Webhooks remain a future seam requiring actual authenticated public delivery; no localhost webhook success is claimed.

## Verification

From an installed checkout, run:

```bash
npm run typecheck
npm test
npm run build
npm run check:bundles
npm run test:smoke
```

The full suite has **67 passing tests**: the original 41 plus 26 focused local-teaching/provider tests in `tests/learning-providers.test.ts`. The focused file can also run with `node --import tsx --test tests/learning-providers.test.ts`. It covers every P01/P16 variant/persona; quiz sequencing, ownership, expiry, context and answer tampering; Gemini/Inworld request/response shapes; missing configuration, authentication/rate/upstream failures, malformed/oversized data; fetch and stalled-body deadlines; execution-mode isolation; caption/text constraints; permission/opt-in denial; logout/context/revocation/failed-refresh late-result rejection; HTTP routes, disconnect cancellation and sanitized errors/audit. All vendor HTTP responses are injected simulations. No live provider was called. Runtime audit emits only request ID, fixed stage, status code and duration; tests check that credentials, explanation text and audio do not appear.

Current increment verification on 2026-10-21: typecheck, all 67 tests, the full workspace build, browser bundle checks (10 generated assets), and the existing companion/actual-unpacked-extension smoke passed. The exact runnable offline request example above also passed against an ephemeral local server with explicitly unavailable vendor adapters. The unchanged browser regression exercises private local-demo session creation, owned assessment creation and logout/replay through the companion proxy; it does not claim new learning UI or live-provider coverage. The positive-toolbar manual checklist remains pending. A historical `verifiedSessionAt` describes an actual successful k-ID test-session read only; current onboarding state/dispatch refresh must still allow the operation.

W02 and this backend increment are reviewable, but the full live demonstration is not complete. Roles B/C can integrate the authenticated HTTP/service boundary and additive shared contracts immediately while keeping their public demo paths. No merge, deployment, live production flow, real-person collection or extension publication is included.

## Local integration follow-up

See [INTEGRATION.md](INTEGRATION.md) for combined verification and exact team snapshots. The optional widget's `/api/kid/claim` response remains `202` with `redeemed: false`. Its `/api/kid/session` route is an authenticated alias of W02 refresh: `Authorization: Bearer <application-credential>` and `{ "contextVersion": <current-version> }`, returning the W02 session view plus `changed`. Arbitrary `sessionId` bodies are rejected. `KID_API_BASE` remains the enforced Test Mode session base; the team's separate `KID_API_BASE_URL` name is retained for purchase planning and does not override W02. No vendor call or `.env` inspection was performed during the integration audit. The earlier Gemini model configuration and diagnostic above are preserved as historical evidence, not reverified authorization.

## Demo integration increment — 2026-10-21

The current source includes P10 toll fixtures alongside P01/P16, a one-time controlled-fixture handoff, persistent anonymous curated progress, explicit consent-withdrawal UI, bounded voice orchestration and a limited eligible-adult FastSpring sandbox checkout. See [DEMO.md](DEMO.md) for exact provider diagnostics, configuration status, final checks and startup/rehearsal instructions. The earlier 67/71-test paragraphs are historical baselines.

All routes below require an application bearer except the existing non-authorizing `/api/kid/claim`. No client-supplied owner, provider session, approval, price, correctness or independence is accepted. Local-demo tickets and progress tokens cannot authorize a provider. Responses/requests use additive contracts in `@beacon/contracts`; provider/rubric implementations remain Node-only.

| Method / route | Request | Behavior |
| --- | --- | --- |
| POST `/api/assessments` | `{contextVersion,fixtureId:"P01"\|"P10"\|"P16",variant}` | Current owned synthetic fixture assessment |
| POST `/api/handoffs` | `{assessmentId,contextVersion}` | Local-demo only; opaque one-time ticket, 45 seconds, source owner/context/expiry checked |
| POST `/api/handoffs/redeem` | `{ticket,contextVersion}` | Requires target local-demo bearer; creates a new target-owned assessment for the same fixture. Never transfers provider permissions |
| POST `/api/progress/identity` | `{}` or `{token}` | Binds this application's session to an anonymous progress identity. Returns a progress-only resume token and progress; neither is application authentication |
| GET `/api/learning` | no body | Nine public challenges with observation/reason/action options; no answer rubric |
| POST `/api/learning/:challengeId/issue` | `{}` | Server-owned run ID and public challenge; reveal/feedback state stays on the server |
| POST `/api/learning/:runId/reveal` | `{}` | Marks the objective practice-only and returns teaching |
| POST `/api/learning/attempts` | `{runId,challengeId,version,credit_key,choiceId,reasonId,actionId,interpretedChoiceConfirmed:true,idempotencyKey}` | Server grading, replay-safe unique credit and exact badges/status, single SQLite transaction |
| GET `/api/progress` | no body | Owned anonymous progress; no browsing evidence |
| POST `/api/progress/reset` | `{}` | Deletes this progress identity's attempts, runs and credits transactionally |
| POST `/api/coaching/questions` | `{assessmentId,contextVersion,question}` | Explicit bounded typed fictional question, provider-test only, existing protected Gemini boundary; no permissions/badges from model output |
| POST `/api/voice/turns` | `{assessmentId,contextVersion,adultPresenterConsent:true}` | Checks all voice grants, opt-ins, adult server context and Modulate/Gemini configuration **before microphone capture**. Returns a ready turn ID, not permission to bypass later checks |
| POST `/api/voice/turns/:turnId` | `{contextVersion,durationMs,mimeType,audioBase64}` | One submission, max 15 seconds / 2 MiB decoded; authenticated voice-specific JSON cap 2,800,000 bytes. Redaction first, then Gemini, then optional Inworld. No raw fallback; matching captions survive speech-only failure |
| POST `/api/voice/turns/:turnId/cancel` | `{}` | Owned turn only; abort/invalidation rejects late results. HTTP disconnects also cancel work |
| GET `/api/purchase-policy` | no body | Honest off/blocked policy status; no unverified parent-admin editing |
| POST `/api/purchases` | `{assessmentId,contextVersion,itemId:"ozone-theme",idempotencyKey}` | Server catalog USD 1.00; local/child contexts get blocked with zero checkout/charge calls. Only genuinely bound eligible adult provider-test contexts with confirmed purchase mapping can create hosted test checkout; no charge adapter exists |

Teaching quizzes remain separate and unscored; the P10 teaching quiz has ID `toll-address-and-request`. Public teaching answers stay server-side. Curated progress uses stable credit keys, unique `(progress identity,credit_key)` and `(progress identity,idempotencyKey)` constraints, `BEGIN IMMEDIATE` and bounded submission rate. The first independent correct observation/reason/action can earn credit. Reveal or any answer feedback marks later attempts practice-only across reissuance; equivalent versions cannot farm credit. Purchases/live flags/model agreement never award credit. Badges are derived from committed unique credits with exact specification thresholds. Disk progress is `.local/progress.sqlite`; memory stores are used by injected tests. Reset deletes the identity's learning data; forgetting its browser token is a separate operation.

### Exact local requests

After the existing session example creates `credential` and `contextVersion`, P10 can use the same `/api/assessments` → `/api/coaching/messages` → `/api/challenges` → `/api/challenges/:id/attempts` sequence by choosing `fixtureId:P10`. Do not print bearer credentials. A JavaScript client can perform the new handoff and independent practice as follows (the variables below refer to already-created local application sessions):

```js
const post = async (path, body, session) => {
  const response = await fetch(`http://127.0.0.1:8787${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.credential}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Local request failed: ${response.status}`);
  return response.json();
};
const owned = await post('/api/assessments', { contextVersion: source.contextVersion, fixtureId: 'P10', variant: 'baseline' }, source);
const handoff = await post('/api/handoffs', { assessmentId: owned.assessment.id, contextVersion: source.contextVersion }, source);
const received = await post('/api/handoffs/redeem', { ticket: handoff.ticket, contextVersion: target.contextVersion }, target);
const identity = await post('/api/progress/identity', {}, target); // keep its progress-only token private locally
const run = await post('/api/learning/link-check/issue', {}, target);
// Render run.challenge.choices, run.reasons and run.actions. Submit the user's
// confirmed selection; never derive correctness or reveal/independence in the client.
const result = await post('/api/learning/attempts', {
  runId: run.runId, challengeId: run.challenge.id, version: run.challenge.version, credit_key: run.challenge.credit_key,
  choiceId: selectedChoiceId, reasonId: selectedReasonId, actionId: selectedActionId,
  interpretedChoiceConfirmed: true, idempotencyKey: crypto.randomUUID(),
}, target);
```

The extension sends only supported fixture IDs/variants, not arbitrary page excerpts. Its worker uses `chrome.storage.session` for the local bearer, exact sender/message validation, an explicit local host grant and the server's configured extension-origin allowlist. The companion removes the handoff fragment immediately and stores application credentials only in closures.

### Preserved provider boundary and new adapters

Real reasoning, redaction, speech and checkout operations run inside `withAuthorizedOperation`. Existing ownership/context checks, permission refresh, `context.assertCurrent()`, cancellation/deadline and final delivery checks remain. New adapters require matching `executionMode`; injected transports are `test-fake` and cannot be combined with real vendor transports behind simulated permissions. Environment cannot select a fake.

Voice uses the documented fixed Modulate batch-redaction endpoint with `X-API-Key`, multipart `upload_file`, `speaker_diarization` and language hint. Node's MIME parser reads the bounded multipart response. Both metadata and MP3 parts are required; nonempty/malformed PII/PHI tags, non-English utterances, oversized/malformed/failed/stalled responses stop the chain. Only the redacted transcript reaches the existing Gemini adapter. Audio/transcripts remain transient; original decoded bytes are zeroed after use, nothing is logged/persisted. This does not establish perfect redaction or zero provider retention. Confirm retention before enabling `MODULATE_RETENTION_CONFIRMED`.

FastSpring uses documented Sessions v2, Basic auth and User-Agent, explicit `live:false` and the server product catalog. The response must remain test mode, match USD 1.00/product/quantity and a returned URL on the configured store's FastSpring host. `checkoutCalls` measures attempted checkout dispatch; `chargeCalls` is always zero. A reservation precedes any await, preventing concurrent duplicate dispatch. A child denial never reaches the adapter. Existing W14 parent policy/link/approval/expiry/saved-method/webhook prerequisites remain unimplemented/blocked; no unsigned approval endpoint or speculative charge operation is exposed.

New optional environment names: `KID_PURCHASE_MAPPING_CONFIRMED`, `MODULATE_RETENTION_CONFIRMED`, `FASTSPRING_CHECKOUT_PATH`, `FASTSPRING_PRODUCT_PATH`, `FASTSPRING_SANDBOX_CONFIRMED`, `BEACON_PROGRESS_PATH`. Existing names and working Gemini model are preserved. Actual configured/missing status and live verification gaps are in DEMO.md; no credential file was copied, overwritten or committed.

Private SDK installation/typecheck/build passed after the archive was supplied. Its bundled docs only name `/client/claim` and token lifetime; they do not specify the server exchange. `/api/kid/claim` therefore stays explicitly `redeemed:false`. No SDK installation, frontend widget pass, requirements GET or standalone Gemini/TTS diagnostic constitutes application approval.

Final current verification: **84 passing tests**, typecheck, complete workspace build, 11-asset browser boundary check and actual built companion/unpacked-extension smoke passed. Real SDK installation/typecheck/optional build passed. The separate real synthetic/provider diagnostics are recorded in DEMO.md and `docs/verification/provider-connectivity-2026-10-21.jsonl`; they do not verify application authorization. Final team fetch remained `17d69b8f361fafad9d307258ce39110067c85ee3`.


## Final two-persona increment (2026-10-21)

The server-owned CDK adult flow was tested against the configured Test Mode secret key: active session, `LEGAL_ADULT`, and enabled `ai-chat`, `ai-voice-mode`, `in-game-purchases`. Official AI permission documentation confirms the coaching mapping to `ai-chat`. A genuine owned P10 question passed through `withAuthorizedOperation`, refresh/assertCurrent and Gemini using the preserved model. The fixed fictional question was Susan’s late-fee concern; the validated response advised independently checking the usual toll app, saved official address or genuine statement number. This is actual application text coaching, not browser claim redemption or voice verification.

Gemini returned documented opaque `thoughtSignature` metadata on its answer part. The adapter now accepts bounded signature metadata and discards it; thought parts, tool calls, foreign evidence, mismatched captions and unsafe output still fail. A simulated regression covers the metadata without exposing it. See [Google’s response metadata contract](https://ai.google.dev/gemini-api/docs/generate-content/thought-signatures).

The approved five-permission declaration through installed SDK 0.1.0 returned **403 Unauthorized**. No test-product setting changed. Actual media-upload/generation grants remain absent; the voice boundary continues to reject the turn before microphone access. User-confirmed Modulate retention and verified Inworld IDs can be supplied per process without editing the preserved environment. The current demo runner explicitly supplies `KID_AI_MAPPING_CONFIRMED`, `MODULATE_RETENTION_CONFIRMED`, `INWORLD_MODEL_ID`, `INWORLD_VOICE_ID`; flags do not add missing provider grants. SDK claim redemption and parent approval remain separate unresolved contracts.

### Authenticated sample budget routes

All routes require an application bearer. Ownership is derived server-side; request bodies reject prices, quantities, owners, approval and policy fields. Sample state cannot authorize or complete provider purchases.

| Route | Body | Result |
| --- | --- | --- |
| `GET /api/family-budget` | None | Exact `familyBudgetSnapshotSchema`, UTC month, spending, reservations and catalog |
| `POST /api/family-budget/requests` | `contextVersion`, owned `assessmentId`, server `itemId`, stable `idempotencyKey` | `{purchase,snapshot}`; scam and provider-test requests blocked, zero dispatches |
| `POST /api/family-budget/requests/:id/cancel` | `contextVersion` | Owner-only local cancellation |
| `POST /api/family-budget/requests/:id/simulate` | `contextVersion`, `outcome: completed/failed/expired` | Local simulation only; expiry requires the server deadline, not caller time |
| `POST /api/family-budget/reset` | `contextVersion` | Local sample reset; pending cancelled, receipts retained; provider-test forbidden |

Example request after creating a local-demo session and owned P01 assessment: `{"contextVersion":1,"assessmentId":"<owned-assessment-id>","itemId":"family-wallet-four","idempotencyKey":"rehearsal-1"}`. Use the actual returned context version. Four wallets reserve 4 × 1099 = 4396 minor units; five wallets cost 5495 and exceed the 5000 per-purchase limit. Five four-wallet reservations consume 21980 of the 25000 monthly sample limit; a sixth is denied. The scam `verification-pack` is always denied at 100.

SQLite `BEGIN IMMEDIATE`, unique owner/request keys and terminal state checks enforce atomic reservations and retries. Pending reservations expire after 15 minutes or the UTC month boundary, whichever comes first. Completed simulations count once; failure/cancellation/expiry release allowance. Reset archives the local generation and retains receipts, so old keys cannot revive spending. The default server keeps this sample store in memory; file-backed multi-process concurrency is separately tested. All outcomes remain `paid:false`, `fulfilled:false`, `checkoutCalls:0`, `chargeCalls:0`.

Catalog prices mirror read-only FastSpring metadata checked on this date: `ozone-layer-family-wallet` USD10.99 and `spark-coins-100` USD0.99, with server-fixed sample cart quantities. This does not confirm billing mode or activate checkout. Real W14 child purchases remain blocked pending verified parent linkage, Transactions/Purchase Controls, approval and saved-method contracts.

`purchase-callbacks.ts` prepares bounded raw-body, constant-time FastSpring Base64 and k-ID timestamped hex HMAC verification. Tests cover signatures, modified bytes, duplicate headers and replay-window policy. There is deliberately no callback route or fulfillment side effect until server-owned request/order correlation, durable order/resource deduplication and genuine approval/payment prerequisites are implemented. A valid signature alone is not a completed payment. Remaining secrets: `KID_WEBHOOK_SECRET`, `FASTSPRING_WEBHOOK_SECRET`; remaining checkout configuration: `FASTSPRING_CHECKOUT_PATH`, `FASTSPRING_PRODUCT_PATH`, `FASTSPRING_SANDBOX_CONFIRMED`.
