# Ozone Layer — One world, every age

Ozone Layer is a browser safety companion for learning to notice online risks, understand evidence and choose a safer next step. This local demo follows fictional Jimmy, 11, and Susan, 68. Basic lessons remain free; real family purchases and full live voice remain blocked.

The `feat/ozone-demo` integration includes team main `b20ed1ad404e1a91dce50c37bd063c819aff9da8` (merged PR #8), preserving the teammate fork merge `bca596637e56ee4542f40405981b0f54bf3fb2e2`. The new increment is recorded at `0fe858a`, reconciled through merge `a304b3b`. It preserves the existing permission boundary, provider adapters and optional private SDK integration. See [the demo runbook](docs/DEMO.md) for the presentation script, verification record and remaining blockers.

## Run locally

Use Node **22.12 or newer within Node 22 LTS** and npm **10 or 11**. Node 22.20.0 and npm 11.6.1 are the verified versions; `.nvmrc` selects that Node release. From this checkout:

```bash
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. API health is **http://127.0.0.1:8787/health**. Ctrl+C stops both servers; occupied ports fail instead of silently changing.

The offline flow needs no credentials and makes no vendor requests. Optional settings are listed in `.env.example`. Preserve any existing `.env` and privately supplied SDK archive; never overwrite, copy into source or commit them. A credential-enabled local process can reference the original private environment file externally. Provider secrets stay server-side.

## Present the two scenes

- **Jimmy · age 11:** “I can give you free credits. Open this link, buy the verification pack, and don’t tell your parents.” Review the secrecy, payment and credential evidence. **Open verification-pack link** first shows a warning; continuing opens only a controlled local fixture. The suspicious `.example` address is illustrative.
- **Susan · Toll email:** “Unpaid toll notice. Pay immediately to avoid additional penalties.” Susan asks: “But what if it’s real? I don’t want a late fee.” Explain that this message cannot establish whether a toll is owed; use a usual account or a number from a genuine statement.
- **Talk it through** exposes explicit recording, **Send**, **Play**, **Stop**, captions and a typed question. Voice setup is inside **Developer test setup**. The server checks eligibility before the microphone prompt. With the currently verified permissions, actual voice is blocked; the text lesson remains usable.
- **Open Jimmy’s sample budget** demonstrates a server-enforced **$50 per purchase / $250 per UTC calendar month** rule. Requests reserve allowance atomically; simulated completion spends it once, while cancellation, failure or expiry releases it. The $1 verification-pack scam stays blocked regardless of remaining allowance. The local ledger mirrors read-only verified product metadata: `ozone-layer-family-wallet` at $10.99 and `spark-coins-100` at $0.99. Four wallet units total $43.96 and fit the sample per-purchase limit; five total $54.95 and exceed it. These quantities and limits demonstrate sample accounting, not approved checkout. No payment or entitlement is created.

P16 educational and ambiguous comparisons, larger text, plain language, server-checked teaching and separate curated badge practice remain available. These are controlled fixture outcomes, not live browsing analysis. Developer permission/consent checks are collapsed below the main flow.

## Build and load the extension

```bash
npm run build
```

1. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select **`apps/extension/dist`**.
2. Keep the app running. Open **http://127.0.0.1:8787/fixtures/P01**, `/fixtures/P10` or `/fixtures/P16`, invoke the extension from Chrome’s toolbar, then choose **Show current-page access**.
3. For **Open owned fixture lesson**, allow the local companion origin when prompted and add the popup’s exact nonsecret extension origin to the server’s `BEACON_EXTENSION_ORIGINS` setting before restarting. See [the manual extension checklist](docs/DEMO.md#build-and-load-the-extension). **Open companion demo** remains available without that setup.
4. Reload the extension after rebuilding.

The extension uses `activeTab`, `scripting` and `storage`, without required host permissions or automatic content scripts. It recognizes visible controlled fixtures only. The one-time owned lesson ticket transfers a fixture selection, never provider authorization. Positive toolbar and optional host-grant interaction still require manual Chrome verification.

## Commands and reset behavior

| Command | Behavior |
| --- | --- |
| `npm ci` | Install all six workspaces from the root lockfile |
| `npm run dev` | Start companion and API with coordinated shutdown |
| `npm run dev:extension` | Watch/rebuild extension artifacts |
| `npm run typecheck` | Check workspaces and test sources |
| `npm test` | Run schema, policy, provider and HTTP tests using simulated providers |
| `npm run build` | Build all workspaces |
| `npm run check:bundles` | Inspect browser assets for server/rubric/secret markers |
| `npm run test:smoke` | Exercise built companion/API and unpacked extension in Chromium |
| `npm run demo:reset` | Print foundation reset guidance; deletes nothing on disk |

Install Chromium with `npx playwright install chromium` before browser smoke. Smoke uses isolated ports **15173/18787** and closes its processes. Playwright **1.55.1** is pinned for the available Ubuntu 20.04 test host.

**Reset demo** restores scene controls and preferences while preserving learning progress and sample budgets. **Reset this sample budget** resets only its local accounting view, cancels pending reservations and retains receipts so old requests cannot replay. Anonymous curated learning persists in ignored `.local/progress.sqlite`; its **Reset learning progress** and **Forget this browser’s progress** controls are separate. The browser’s progress-only resume token grants no application capabilities. Recordings, transcripts and browsing history are never persisted.

## Provider status and authorization

| Provider | Verified state / remaining blocker |
| --- | --- |
| k-ID CDK | A genuine adult Test Mode session was active and returned `ai-chat`, `ai-voice-mode`, `in-game-purchases` only. Missing `ai-media-upload` and `ai-media-generation` keep voice denied. The documented coaching mapping was confirmed against these actual grants; parent linkage and media access remain unverified. |
| Private browser SDK | Five reviewed declarations: the three names above plus both media permissions; memory excluded. A real declaration attempt through the installed SDK returned **403 Unauthorized** and changed no vendor settings. Browser claim redemption remains unresolved. |
| Gemini | Standalone fictional-text connectivity and structured parsing verified with the existing working model. A real owned CDK adult P10 Gemini question also passed after the documented signature-metadata parsing fix; voice remains blocked. |
| Inworld | Earlier real synthetic MP3 diagnostic succeeded with `inworld-tts-2` / `Aanya`. Application model/voice IDs are missing; live application playback remains unverified. |
| Modulate | Earlier synthetic multipart-redaction diagnostic succeeded. The user confirmed retention, but `MODULATE_RETENTION_CONFIRMED` is absent from the preserved root environment. Explicit per-process configuration is available after required vendor grants are established. Redaction accuracy and full live application behavior remain unverified. |
| FastSpring | Read-only product metadata confirmed `ozone-layer-family-wallet` at USD 10.99 and `spark-coins-100` at USD 0.99. Billing mode, checkout mapping, saved-method charging and purchase approval remain unresolved. No actual checkout, payment or fulfillment occurred. |

The existing voice chain is **Modulate redaction → Gemini reasoning → Inworld speech**. Tests simulate provider responses; successful standalone diagnostics, browser grants and SDK visibility do not authorize application operations. Only an explicitly consenting adult presenter may record a fictional question, processed transiently in memory. Stop, consent withdrawal and navigation stop capture/playback and discard late output. No emotion detection is implemented.

Prepared k-ID/FastSpring signature verifiers have tests; they are not wired to webhook routes or fulfillment. The actual W14 flow still requires verified parent-child linkage, approved policy, signed correlated approvals, replay-safe events and confirmed saved-payment APIs. Sample accounting does not authorize real purchases.

## Optional k-ID widget

The privately supplied SDK archive is an ignored optional dependency. The default offline build works without it. To enable the actual widget, supply the approved private archive, existing browser-safe publishable key/support-email settings and the explicit widget build flag described in [the runbook](docs/DEMO.md#private-sdk-and-claim-boundary).

`POST /api/kid/claim` returns `202`, `redeemed:false` until the vendor confirms the server exchange and owner binding. `POST /api/kid/session` refreshes only the authenticated application session; caller-supplied vendor session IDs are rejected. No SDK stub, simulated approval or guessed claim endpoint is used.

The companion is a responsive web app and supports 390px Chromium checks. Real Safari/iOS/Android and WebViews remain unverified; mobile Chrome does not run this desktop extension. Native clients and general browsing detection are future work.

## Team and documentation

Harsh owns backend permissions and purchases; Joseph owns extension and experience; Angela coordinates integration and AI/voice with Joseph. Shared contracts and the browser/server claim boundary need Harsh/Joseph review. Follow [CONTRIBUTING.md](CONTRIBUTING.md): feature branches, one teammate approval, green guard checks and squash merge. No direct team-main push, deployment or extension publication is included.

See [DEMO.md](docs/DEMO.md), [backend handoff](docs/BACKEND.md), [integration handoff](docs/INTEGRATION.md), [work plan](docs/WORK_PLAN.md) and [functional specification](INTERNET_SAFETY_COMPANION_FUNCTIONAL_SPEC_FINAL.md). Older handoffs contain historical implementation baselines; the runbook records the current demo state.

“Ozone Layer” is the working product name. Internal `@beacon/*`, `BEACON_*` and existing IDs retain earlier naming to preserve compatibility.
