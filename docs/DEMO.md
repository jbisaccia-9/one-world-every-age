# Ozone Layer demo runbook

The current local demo presents fictional Jimmy, 11, and Susan, 68, with controlled evidence, text teaching and a separate sample family budget. Full vendor-authorized voice, browser claim redemption and real parent-approved saved-method purchases remain blocked. Connectivity diagnostics do not establish application authorization.

## Current integration

Branch `feat/ozone-demo` includes team main `8daeb8cc92a9c06520928a8b38080be72a60e116` through merge `2274e7317c98a0db2ca4de017f29b4e679ab6156`. Earlier W02/backend work, the local teaching/provider increment and the real optional SDK integration are preserved. The original checkout and private environment file remain separate; no credentials or SDK archive belong in Git.

Harsh and Joseph review shared contracts, extension handoff, permissions and purchases. Angela and Joseph review voice capture, captions and the existing Modulate/Gemini/Inworld adapters. This is a local integration, not a deployment or extension publication.

## Start the offline demo

Open the running companion at **http://127.0.0.1:5173**; API health is **http://127.0.0.1:8787/health**. To start from this checkout with Node 22 LTS (verified 22.20.0) and npm 10/11:

```bash
npm ci
npm run dev
```

Ctrl+C stops both servers. Occupied ports fail. The offline scenes need no credentials and make no vendor requests. The current credential-enabled process references the original private environment file externally; keep that file in place and do not copy, overwrite or commit it. Portable startup commands above also work without provider configuration.

Fixture pages are `/fixtures/P01`, `/fixtures/P10` and `/fixtures/P16` on either local origin. Their `.example` destinations are labelled illustrations; actual fixture navigation stays local. No email account, game store or general browsing feed is scanned.

## Two-minute presentation

Use the default offline flow. Prepare any manual Chrome extension grants before presenting, or begin directly in the companion.

- **0:00–0:25:** Choose **Jimmy · age 11**. Read: “I can give you free credits. Open this link, buy the verification pack, and don’t tell your parents.” Point to secrecy, payment and credential evidence. Choose **Open verification-pack link** and show the warning; **Stay on this page** dismisses it. Continuing opens only the controlled local fixture. Explain that a free offer requiring payment and secrecy deserves a pause and help from a trusted adult.
- **0:25–0:55:** Choose **Open Jimmy’s sample budget**. Show **$50 per purchase / $250 per calendar month, UTC**. Check the $1 verification-pack offer: it stays blocked even with money available. Use the local mirror of `ozone-layer-family-wallet` at $10.99: four units total $43.96 and fit the sample rule; five total $54.95 and exceed its per-purchase cap. A permitted request reserves allowance; **Cancel reservation** releases it. Product prices were verified by read-only metadata; the limits and outcomes remain local accounting, not an approved parent policy or checkout. No payment occurs.
- **0:55–1:20:** Choose **Susan · Toll email**. Read: “Unpaid toll notice. Pay immediately to avoid additional penalties.” Susan asks: “But what if it’s real? I don’t want a late fee.” Explain: “We cannot establish whether a toll is owed. Open your usual account or call a number from a genuine statement; do not use this email link.” The text lesson works immediately. Show **Talk it through**, **Send**, **Play**, **Stop** and captions as the implemented optional interface; disclose that current vendor media grants block actual voice.
- **1:20–1:50:** Choose **Start curated practice**, a new challenge, then an observation, evidence-based reason and independent safe action. An independent correct attempt can earn **First Safe Step**, one credit. A repeat earns no new credit. Teaching questions beside the scene remain unscored.
- **1:50–2:00:** Return to the clear text explanation. Larger text, plain language and P16 educational/ambiguous comparisons are available. If asked about integrations, open **Developer test setup** or **Developer diagnostics and permission checks** and show the actual blockers.

Use **Reset learning progress** before rehearsing if a first badge is needed. Do not reveal an answer before an independent attempt. **Reset demo** resets scene controls and preferences while preserving learning and sample budgets.

## Sample family accounting

**Open Jimmy’s sample budget** creates a separate owned local-demo session. Prices and the fixed $50/$250 policy come from the server. Transactions atomically reserve the available UTC calendar-month balance, including existing pending reservations. Idempotent retries reuse the original result; different payloads cannot reuse its key. Completion spends the reservation once. Cancellation, failure and expiry release it; expiry occurs after 15 minutes or at the next UTC month boundary, whichever comes first. Terminal receipts cannot be revived. Five $43.96 reservations use $219.80 and leave $30.20; a sixth $43.96 reservation is denied by the monthly limit, even though each request fits the $50 cap.

Under **Simulate an outcome**, completion/failure affect sample accounting only. The legitimate ledger entries are labelled **Sample cart** and mirror read-only metadata checked on 2026-10-21 for `ozone-layer-family-wallet` (USD 10.99) and `spark-coins-100` (USD 0.99); server-fixed quantities provide the $43.96 four-unit and $54.95 five-unit examples. This local mirror creates no vendor checkout and does not establish product billing mode, saved-payment support or parental approval. The fictional scam verification pack is a separate example, blocked before budget eligibility even at $1. Provider-mode family requests remain blocked while parent linkage, policy and approval are unverified. Zero checkout, charge or entitlement calls are made by this sample flow.

**Reset this sample budget** cancels pending reservations and starts a fresh local accounting view while retaining owner-bound receipts against replay. It preserves learning progress and other sessions. Sample ledger state is held in the API process’s in-memory SQLite store; it is not a verified parent wallet.

## Voice controls and cancellation

The presenter interface keeps Susan’s exact question visible and prefilled in **Fictional text question**. **Ask using text** uses the existing protected coaching route. Provider errors remain visible; the offline explanation above stays available throughout.

To inspect setup, open **Developer test setup**, explicitly opt in as a consenting adult presenter, then choose **Start server-owned provider test**. A genuine pending challenge link is shown only if returned by the server. **Refresh provider permissions** uses that session’s current version. The optional browser widget is a separate system and cannot approve these server operations.

**Talk it through** checks server eligibility before requesting browser microphone access. Capture is bounded to 15 seconds / 2 MiB. **Send** stops capture and submits to Modulate redaction → existing Gemini reasoning → optional Inworld speech. Recording, microphone-wait, processing and playback states are visible. Captions contain the validated spoken text. Speech-only failure preserves captions; autoplay denial preserves transient audio for explicit **Play** and replay. **Stop**, new work, consent withdrawal and navigation stop the microphone/player, revoke audio URLs and discard late work. No background listening or emotion detection is implemented.

Current application voice is blocked by missing media grants and configuration. Browser lifecycle checks used explicitly simulated media and provider responses; no recording or vendor authorization was fabricated. Full live capture/redaction/playback remains unverified.

## Build and load the extension

```bash
npm run build
```

In Chrome, open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose **`apps/extension/dist`**. Reload after rebuilding.

1. Open **http://127.0.0.1:8787/fixtures/P01**, invoke Ozone Layer from the actual toolbar and choose **Show current-page access**. Repeat for P10 and P16. The extension recognizes exact visible fixture text and destination metadata on loopback URLs; hidden/editable/form content is excluded. P16 remains a contextual comparison.
2. For the owned handoff, copy the popup’s nonsecret extension origin from **Local connection** into the server’s comma-separated `BEACON_EXTENSION_ORIGINS` setting, then restart the API. `BEACON_COMPANION_ORIGIN` defaults to `http://127.0.0.1:5173` and is baked into the extension; rebuild if changing it. CORS allowlisting grants no application permission.
3. Choose **Open owned fixture lesson** and allow access to the local companion origin when Chrome asks. The worker holds its application bearer in `chrome.storage.session`. A one-use, 45-second ticket opens the companion, removes the URL fragment and redeems a new assessment owned by the companion’s separate session. It transfers only fixture selection, not a bearer, excerpts or provider grants. Used, expired, signed-out and stale-context references are rejected.
4. Without local access/CORS setup, the on-page explanation and **Open companion demo** remain available. No required host permissions or automatic content scripts were added.

Automation loads the actual unpacked extension and exercises its worker, popup, restricted-page rejection, built content recognition/dismissal and HTTP lesson handoff. The positive toolbar/`activeTab` grant and optional host-permission prompt still require these manual steps; scripted content execution does not prove Chrome granted access. General browsing detection and automatic monitoring are unavailable.

## Provider evidence and current blockers

The earlier sanitized [connectivity record](verification/provider-connectivity-2026-10-21.jsonl) remains historical evidence. The current checks below supersede its earlier unknown session/retention entries. No credentials, audio or response transcripts are committed.

| Provider | Observed result | Application consequence |
| --- | --- | --- |
| k-ID CDK | A real adult Test Mode session was **active** and returned only `ai-chat`, `ai-voice-mode`, `in-game-purchases`. | Missing `ai-media-upload` and `ai-media-generation` deny voice. These grants do not establish parent linkage, media entitlement or the browser claim exchange. CDK presets are 8/15/34; fictional scene ages 11/68 are not vendor age claims. |
| Private SDK | Installed `@k-id/core` 0.1.0 attempted the user-approved five-permission declaration and returned **403 Unauthorized**. No vendor settings changed. | Declaration did not establish the missing media grants. Memory permission is excluded. The browser SDK and server CDK remain separate. |
| Gemini | Prior fixed-fictional-text diagnostic verified the existing working model and structured/evidence parsing. | Existing key/model configuration is preserved. Genuine owned CDK adult P10 Gemini text coaching passed after fixing documented signature metadata. The actual companion rendered its captions; voice remained denied before any microphone request. |
| Inworld | Earlier real synthetic MP3 synthesis succeeded with `inworld-tts-2` and system voice `Aanya`. | `INWORLD_MODEL_ID` / `INWORLD_VOICE_ID` are missing from the preserved root environment. Those diagnostic selections were not written there. Live application audio/caption alignment remains unverified. |
| Modulate | Earlier synthetic Inworld clip passed multipart batch redaction; no transcript was sent to Gemini. The user has now confirmed retention. | `MODULATE_RETENTION_CONFIRMED` remains absent from the preserved root environment. An explicit per-process setting may be used after required vendor grants are established. The short diagnostic does not establish redaction accuracy. |
| FastSpring | Read-only catalog and per-product metadata returned `ozone-layer-family-wallet` at USD 10.99 and `spark-coins-100` at USD 0.99 (HTTP 200). No actual checkout or charge occurred. | Billing mode, checkout mapping, saved-method APIs, verified parent approval and order completion remain unresolved. The local ledger mirrors metadata only; it cannot authorize provider purchases. |

Do not infer media approval from `ai-voice-mode` alone, fabricate grants, or flip mapping settings merely to pass a demo. Inworld model/voice and confirmed Modulate retention can be supplied to a later local process without modifying the original private environment, The current local process uses the confirmed coaching mapping and these nonsecret provider settings; actual missing media grants still deny voice. Missing or malformed configuration fails closed while offline startup remains available.

The FastSpring Sessions adapter sends and validates `live:false` and rechecks authorization for cached checkout URLs. Its positive checkout tests use injected simulated responses. Prepared raw-body signature verifiers cover k-ID and FastSpring callbacks, but no webhook routes, event consumption, business correlation, paid orders or fulfillment are wired to them. A valid signature alone is not approval or proof of payment.

## Private SDK and claim boundary

The supplied `vendor/k-id-core-web.tgz` is an ignored optional local dependency. Default `npm ci`, typecheck and offline build work without it. The actual installed SDK is used when available; no stub is substituted. Optional widget typecheck/build commands are:

```bash
npx tsc --noEmit -p integrations/kid/tsconfig.json
BEACON_KID_WIDGET_ENABLED=true npm run build --workspace=@beacon/companion
npm run check:bundles
```

Widget startup requires the existing `VITE_KID_PUBLISHABLE_KEY` and `VITE_KID_SUPPORT_EMAIL`; `VITE_KID_BASE_URL` defaults to the SDK’s Test Mode FAPI host. The reviewed declaration is exactly `ai-chat`, `ai-voice-mode`, `ai-media-upload`, `ai-media-generation`, `in-game-purchases`. The attempted real declaration failed with 403; no permission or setting change is claimed.

The bundled documentation says `onClaim(claimToken)` can follow a passed or pending age check. It names a ten-minute one-time token and `/client/claim` but does not define the required server host/authentication/request/response and current-owner binding. `/api/kid/claim` therefore remains `202`, `redeemed:false`. No guessed endpoint or caller-supplied vendor session UUID becomes application ownership. Harsh/Joseph need the vendor-confirmed exchange, replay and owner-binding contract before enabling it. A widget pass cannot replace this step or authorize W02 operations.

## Persistence, privacy and reset

Anonymous curated progress lives in ignored `.local/progress.sqlite`. Only the progress resume token `ozone.progress.resume` is stored in browser local storage; application credentials stay in memory. The optional widget may store its own opaque SDK session/challenge identifiers when enabled. **Reset learning progress** deletes this identity’s credits, attempts and challenge runs; **Forget this browser’s progress** removes its resume token. Clearing/sharing anonymous tokens can reset/share progress; this is not account-level anti-abuse.

**Reset demo** changes scene controls only. **Reset this sample budget** affects only its owned sample accounting. `npm run demo:reset` prints foundation guidance and deletes nothing from disk; it does not erase learning or budget receipts. No browsing history, recordings, transcripts or coaching memory are persisted. Only an explicitly consenting adult presenter may record a fictional question, processed transiently in memory; never record a child or real player.

## Remaining integration work

1. **Harsh + Joseph, vendor mentor:** resolve SDK declaration authorization, missing media permissions, actual product mapping and browser claim owner binding; exercise genuine permitted, denied and revoked sessions. Protected CDK adult P10 Gemini text coaching passed; full voice still needs the media grants.
2. **Angela + Joseph, Harsh:** after vendor grants, apply the explicitly confirmed process configuration, rehearse one adult fictional voice turn, matching captions and Stop at every stage; verify retention/redaction quality and real browser playback.
3. **Joseph + Harsh:** complete the manual Chrome toolbar/local-host grant and owned handoff checklist; check mobile Safari/Android and accessibility. A genuine jurisdiction comparison still needs actual provider evidence; the labelled offline consent-withdrawal example is separate.
4. **Harsh + Joseph, Angela:** confirm sandbox checkout mapping, product billing mode and saved-method contracts, verified parent-child linkage, parent policy/approval and replay-safe, correlated signed events. Only then exercise synthetic test checkout/order fulfillment. Parent limits are not implemented by declaring a purchase permission, and the sample budget never authorizes payment. Protection, lessons and badges remain free.

## Validation record

Final integrated verification on 2026-10-21: **109 tests passed**, zero failures/cancellations/skips. Typecheck, optional real-SDK typecheck, all workspace builds, 11-asset browser bundle inspection and the actual combined Chromium/unpacked-extension smoke passed. Focused budget/HTTP/callback tests include real parallel SQLite processes and owner/context checks. Original 22 checkpointed source/document hashes and staged index remain unchanged; no credential file or SDK archive was copied, changed or staged.

Required checks are `npm run typecheck`, `npm test`, `npm run build`, `npm run check:bundles` and `npm run test:smoke`, plus the actual optional SDK typecheck/build when available. Automated provider fixtures are injected simulations. Browser media lifecycle checks cover Send/captions, autoplay denial/manual replay, microphone denial/typed fallback, consent withdrawal and late results across Stop/refresh/setup/playback/navigation; these establish UI behavior, not a real recording or vendor authorization.

Remaining manual/live checks include actual toolbar/host grants; browser claim exchange and missing media grants; full voice; real adult playback/redaction quality; genuine jurisdiction difference; actual sandbox order and signed fulfillment; parent approval/saved-method charging; Safari/Android devices. These remain pending. No deployment, extension publication, credential-file write or actual payment was performed. The upstream PR/review status is recorded below.


### Verified provider-test text fallback

After the SDK declaration was denied, the documented secret-key CDK flow independently produced a genuine owned adult session. A real P10 question through the existing authorization boundary and, separately, the actual companion returned validated Gemini text with matching captions. The response advised the usual toll app, saved official address or a number on a genuine statement. No transcript, signature metadata or recording is persisted. The working model setting was preserved.

The current local runner supplies these already-confirmed nonsecret settings per process (not by editing the original environment):

```bash
KID_AI_MAPPING_CONFIRMED=true MODULATE_RETENTION_CONFIRMED=true \
INWORLD_MODEL_ID=inworld-tts-2 INWORLD_VOICE_ID=Aanya npm run dev
```

Use that command only with the same reviewed Test Mode product/mapping and confirmed retention. It does not grant missing media permissions. A fresh browser test confirmed voice returned **403 before any microphone request**. To show the verified typed fallback: Susan → consenting adult checkbox → Developer test setup → Start server-owned provider test → Ask using text. The default fictional concern is prefilled. The server’s CDK test preset is an adult test identity, distinct from Susan’s fictional scene age.

The protected route initially rejected a valid documented Gemini `thoughtSignature` metadata field; accepting and discarding that bounded metadata fixed the compatibility failure without relaxing evidence, caption, ownership, permission or cancellation checks. See [the official response metadata documentation](https://ai.google.dev/gemini-api/docs/generate-content/thought-signatures).

The automated offline click-path rehearsal completed in **1.5 seconds** excluding narration, reading and provider operations. The two-minute script above allocates presenter time around that verified path; a spoken 120-second recording and full live-voice rehearsal remain manual.


### Recorded integration snapshots

The final fetch found team main `b20ed1ad404e1a91dce50c37bd063c819aff9da8`, the squash merge of [PR #8](https://github.com/jbisaccia-9/one-world-every-age/pull/8). Its source tree matched the recorded `f030b7c` baseline except for the already-preserved vendor ignore rule. The teammate fork merge `bca596637e56ee4542f40405981b0f54bf3fb2e2` was preserved. This increment `0fe858a` adds the two-scene changes; merge `a304b3b` records the actual team snapshot. Fifteen squash-history conflicts were resolved only after each team file was proven identical to the baseline, retaining the tested increment. No independent teammate source change was discarded. Fork main remained `97675eceedd2c3f722751fd5e81fb5f34106055a`. No further moving-main merge is being chased.

The earlier integration is already merged upstream. This new increment requires its own teammate approval and green `guard` before squash merge; agent checks are not teammate approval. The feature branch is the review target, never a direct main push.


### Follow-up review handoff

The checked increment was pushed to `Harshvardhan-Garude/one-world-every-age:feat/ozone-demo`; the local secret guard passed. The GitHub connector rejected creation of the follow-up upstream pull request with **403: Resource not accessible by integration**. No new PR or merge is claimed. Open [the prepared comparison](https://github.com/jbisaccia-9/one-world-every-age/compare/main...Harshvardhan-Garude:feat/ozone-demo?expand=1), create the follow-up PR, then obtain the required teammate approval and green `guard` before squash merging. The earlier PR #8 and its upstream merge are already verified; this new increment is separate.
