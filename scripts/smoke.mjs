import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const browserProfile = await mkdtemp(path.join(tmpdir(), 'beacon-smoke-'));
const apiPort = 18787, webPort = 15173;
const base = `http://127.0.0.1:${webPort}`;
const extensionPath = path.join(root, 'apps/extension/dist');
const processes = [];
let browser;
let output = '';
function start(args) {
  const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, API_PORT: String(apiPort), COMPANION_PORT: String(webPort), BEACON_COMPANION_ORIGIN: base, BEACON_EXTENSION_ORIGINS: '', BEACON_PROGRESS_PATH: ':memory:' }, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output = (output + chunk.toString()).slice(-8000); });
  child.on('error', error => { output += error.message; }); processes.push(child); return child;
}
async function waitFor(url) {
  for (let i = 0; i < 80; i++) {
    if (processes.some(child => child.exitCode !== null)) throw new Error(`A smoke server exited. ${output}`);
    try { if ((await fetch(url)).ok) return; } catch { /* starting */ }
    await delay(150);
  }
  throw new Error(`Smoke server did not start. ${output}`);
}
try {
  const manifest = JSON.parse(await readFile(path.join(extensionPath, 'manifest.json'), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.content_scripts, undefined);
  assert.deepEqual(manifest.permissions, ['activeTab', 'scripting', 'storage']);
  start(['apps/api/dist/main.js']);
  start(['node_modules/vite/bin/vite.js', 'preview', 'apps/companion', '--config', 'apps/companion/vite.config.ts', '--host', '127.0.0.1', '--port', String(webPort), '--strictPort']);
  await waitFor(`http://127.0.0.1:${apiPort}/health`); await waitFor(base);
  browser = await chromium.launchPersistentContext(browserProfile, { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`], viewport: { width: 1360, height: 1000 } });
  const page = await browser.newPage();
  const pageErrors = []; page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(base);
  await page.getByTestId('fixture-title').waitFor();
  assert.equal(await page.getByTestId('fixture-title').textContent(), 'The free reward offer');
  assert.match(await page.locator('main').textContent(), /gifts-check.example/);
  for (const persona of ['teen', 'adult', 'child']) {
    const response = page.waitForResponse(r => r.url().includes('/api/challenges?') && r.status() === 200);
    await page.locator('#persona').selectOption(persona);
    await response;
    await page.getByTestId('fixture-title').waitFor();
  }
  await page.getByLabel('Larger text', { exact: true }).check();
  assert.match(await page.locator('.app').getAttribute('class'), /large/);
  await page.getByLabel('Plain language', { exact: true }).check();
  await page.getByRole('button', { name: 'P16 · Learning page' }).click();
  await page.getByText('No supported indicators in this fixture', { exact: true }).waitFor();
  await page.getByLabel('Example variant').selectOption('ambiguous');
  await page.getByText('? Not enough evidence', { exact: true }).waitFor();
  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: 'Check my answer' }).click();
  await page.getByTestId('teaching-feedback').filter({ hasText: 'Server-checked local-demo practice' }).waitFor();
  assert.match(await page.getByTestId('teaching-feedback').textContent(), /Take another look/);
  for (const fixtureId of ['P01', 'P16']) {
    await page.getByRole('button', { name: fixtureId === 'P01' ? 'P01 · Game reward' : 'P16 · Learning page' }).click();
    await page.getByRole('radio').first().waitFor();
    // Select by visible meaning; answer keys remain in the server-only rubric.
    await page.getByRole('radio', { name: fixtureId === 'P01' ? 'The address and what the page asks me to share' : 'Read the context and check what the page actually asks me to do' }).check();
    await page.getByRole('button', { name: 'Check my answer' }).click();
    await page.getByTestId('teaching-feedback').filter({ hasText: 'That observation fits the lesson.' }).waitFor();
    assert.match(await page.getByTestId('teaching-feedback').textContent(), /No mastery credit was awarded/);
  }
  await page.getByText('Developer diagnostics and permission checks', { exact: true }).click();
  // Actual authenticated sample routes: reserve once, cancel, block the scam.
  await page.getByRole('button', { name: 'Open Jimmy’s sample budget' }).click();
  await page.getByTestId('family-budget-totals').waitFor();
  await page.getByRole('button', { name: 'Request sample reservation' }).click();
  await page.getByTestId('family-budget-result').filter({ hasText: 'Sample reservation allowed' }).waitFor();
  assert.match(await page.getByTestId('family-budget-totals').textContent(), /\$43\.96/);
  await page.getByRole('button', { name: 'Cancel reservation' }).click();
  await page.getByTestId('family-budget-result').filter({ hasText: 'cancelled' }).waitFor();
  await page.getByLabel('Choose a sample catalog item').selectOption('verification-pack');
  await page.getByRole('button', { name: 'Check the verification-pack offer' }).click();
  await page.getByTestId('family-budget-result').filter({ hasText: 'blocked' }).waitFor();
  await page.getByRole('button', { name: 'Try restricted demo purchase' }).click();
  await page.getByTestId('purchase-result').filter({ hasText: 'Checkout calls: 0. Charge calls: 0.' }).waitFor();
  await page.getByRole('button', { name: 'Susan · Toll email' }).click();
  await page.getByTestId('fixture-title').filter({ hasText: "Susan's fictional toll email" }).waitFor();
  await page.getByLabel('Example variant').selectOption('baseline');
  await page.getByText('Do not pay through this email.', { exact: false }).waitFor();
  assert.match(await page.locator('.evidence').textContent(), /toll-notice.example/);
  await page.getByText('Developer diagnostics and permission checks', { exact: true }).evaluate(node => { node.closest('details').open = true; });
  await page.getByRole('button', { name: 'Demonstrate consent withdrawal' }).click();
  await page.getByTestId('consent-result').filter({ hasText: 'The old assessment was rejected.' }).waitFor();
  const storage = await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) }));
  assert.deepEqual(storage, { local: [], session: [] }, 'Application bearer credentials must stay out of browser storage');
  assert.equal(new URL(page.url()).search, '', 'Navigation must not contain application credentials');
  await page.getByRole('button', { name: 'Start curated practice' }).click();
  await page.getByLabel('Curated challenge').selectOption('link-check');
  await page.getByLabel('Observation', { exact: true }).selectOption('observe');
  await page.getByLabel('Reason', { exact: true }).selectOption('evidence');
  await page.getByLabel('Safe action', { exact: true }).selectOption('independent');
  await page.getByRole('button', { name: 'Confirm and submit challenge' }).click();
  await page.getByTestId('progress').filter({ hasText: 'First Safe Step' }).waitFor();
  await page.getByRole('button', { name: 'Confirm and submit challenge' }).click();
  await page.getByTestId('practice-feedback').filter({ hasText: 'no new credit' }).waitFor();
  assert.match(await page.getByTestId('progress').textContent(), /1 unique mastery credits/);
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), ['ozone.progress.resume']);
  // Force a stale/expired answer response: the UI must show recovery and never
  // mistake an HTTP failure for server-checked success.
  await page.route('**/api/challenges/*/attempts', route => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: 'CONFLICT', message: 'Context changed.', retryable: true, requestId: 'smoke-stale' }) }));
  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: 'Check my answer' }).click();
  await page.getByRole('alert').filter({ hasText: 'expired or changed' }).waitFor();
  await page.unroute('**/api/challenges/*/attempts');
  await page.getByRole('button', { name: 'Reload example' }).click();
  await page.getByRole('radio').first().waitFor();
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await page.getByText('⚑ Concern in this fixture', { exact: true }).waitFor();
  assert.equal(await page.getByRole('radio').first().isChecked(), false);
  // Simulated ready response exercises UI microphone denial without granting
  // backend/vendor authorization or making any provider request.
  await page.getByText('Developer test setup', { exact: true }).click();
  await page.getByLabel('I am a consenting adult presenter.', { exact: false }).check();
  await page.getByRole('button', { name: 'Start server-owned provider test' }).click();
  await page.getByLabel('Fictional text question').waitFor();
  await page.evaluate(() => { window.__microphoneCalls = 0; navigator.mediaDevices.getUserMedia = async () => { window.__microphoneCalls++; throw new DOMException('Synthetic denial', 'NotAllowedError'); }; });
  assert.equal(await page.evaluate(() => window.__microphoneCalls), 0);
  await page.route('**/api/voice/turns', route => route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ turnId: '11111111-1111-4111-8111-111111111111', contextVersion: 1, stage: 'ready' }) }));
  await page.getByRole('button', { name: 'Talk it through', exact: true }).click();
  await page.getByTestId('provider-message').filter({ hasText: 'Microphone access denied.' }).waitFor();
  assert.equal(await page.evaluate(() => window.__microphoneCalls), 1);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await page.getByTestId('provider-message').filter({ hasText: 'Late responses are discarded.' }).waitFor();
  await page.unroute('**/api/voice/turns');
  console.log('PASS: explicit Talk is required before the microphone; simulated ready response + browser denial preserved text, and Stop reset the voice UI. This is not provider authorization.');
  await page.screenshot({ path: path.join(tmpdir(), 'beacon-foundation.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile shell must not overflow');
  const fixturePage = await browser.newPage();
  await fixturePage.goto(`${base}/fixtures/P01`);
  await fixturePage.getByRole('heading', { name: 'The free reward offer' }).waitFor();
  assert.equal(await fixturePage.locator('input, form').count(), 0);
  // Exercise the actual built content artifact in the controlled browser page.
  // This verifies extraction/rendering, independently of the manual activeTab grant.
  const contentArtifact = await readFile(path.join(extensionPath, 'content.js'), 'utf8');
  await fixturePage.evaluate(contentArtifact);
  assert.equal(await fixturePage.evaluate(() => globalThis.__beaconFixtureResult?.fixtureId), 'P01', 'Built content must expose the bounded result even inside Vite’s wrapper');
  assert.match(await fixturePage.locator('#beacon-foundation-notice section').textContent(), /Concern in controlled fixture/);
  const beforeRiskyClick = fixturePage.url();
  await fixturePage.getByRole('link', { name: 'Open verification-pack link' }).click();
  await fixturePage.getByRole('dialog').waitFor();
  assert.equal(fixturePage.url(), beforeRiskyClick, 'Warning must precede fixture link navigation');
  await fixturePage.getByRole('button', { name: 'Stay on this page' }).click();
  await fixturePage.evaluate(contentArtifact);
  assert.equal(await fixturePage.locator('#beacon-foundation-notice').count(), 1);
  await fixturePage.getByRole('button', { name: 'Dismiss', exact: true }).click();
  assert.equal(await fixturePage.locator('#beacon-foundation-notice').count(), 0);
  await fixturePage.goto(`${base}/fixtures/P10`);
  await fixturePage.evaluate(contentArtifact);
  assert.match(await fixturePage.locator('#beacon-foundation-notice section').textContent(), /toll-notice.example/);
  await fixturePage.goto(`${base}/fixtures/P16`);
  await fixturePage.getByRole('heading', { name: 'A lesson about suspicious messages' }).waitFor();
  await fixturePage.evaluate(contentArtifact);
  assert.match(await fixturePage.locator('#beacon-foundation-notice section').textContent(), /No supported indicators in fixture/);
  assert.deepEqual(pageErrors, []);
  const handoffUrl = await page.evaluate(async () => {
    const post = async (path, body, credential) => { const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) }, body: JSON.stringify(body) }); if (!r.ok) throw new Error('Handoff setup failed'); return r.json(); };
    const source = await post('/api/onboarding/session', { mode: 'local-demo', syntheticProfile: 'adult', jurisdiction: 'US-CA', optIns: { cloudAnalysis: false, spokenCoaching: false, memory: false } });
    const owned = await post('/api/assessments', { contextVersion: source.contextVersion, fixtureId: 'P10', variant: 'baseline' }, source.credential);
    const result = await post('/api/handoffs', { assessmentId: owned.assessment.id, contextVersion: source.contextVersion }, source.credential);
    return `/?fixture=P10&variant=baseline#handoff=${result.ticket}`;
  });
  await page.goto(`${base}${handoffUrl}`);
  await page.getByTestId('fixture-title').filter({ hasText: "Susan's fictional toll email" }).waitFor();
  assert.equal(new URL(page.url()).hash, '', 'Consumed handoff references must leave the address bar');
  console.log('PASS: actual HTTP one-time fixture handoff → new owned companion assessment → explanation/quiz; no application bearer or evidence in the URL.');
  const privateFlow = await page.evaluate(async () => {
    const created = await fetch('/api/onboarding/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'local-demo', syntheticProfile: 'adult', jurisdiction: 'US-CA', optIns: { cloudAnalysis: false, spokenCoaching: false, memory: false } }) });
    const session = await created.json();
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${session.credential}` };
    const owned = await fetch('/api/assessments', { method: 'POST', headers, body: JSON.stringify({ contextVersion: session.contextVersion, fixtureId: 'P01', variant: 'baseline' }) });
    const body = await owned.json();
    const logout = await fetch('/api/onboarding/logout', { method: 'POST', headers, body: '{}' });
    const replay = await fetch('/api/capabilities', { headers });
    return { created: created.status, owned: owned.status, correctOwner: body.assessment?.ownerId === session.ownerId, fixtureSource: body.assessment?.source, logout: logout.status, replay: replay.status };
  });
  assert.deepEqual(privateFlow, { created: 201, owned: 201, correctOwner: true, fixtureSource: 'fixture', logout: 200, replay: 401 });
  console.log('PASS: browser-origin private local-demo session, owned assessment and logout/replay via companion proxy; no vendor call or credential logged.');
  console.log('PASS: built companion → authenticated assessment → scripted explanation → curated P01/P16 quiz → server-checked feedback, child/teen/adult contexts, stale-context recovery, no bearer storage/URLs, preferences, reset, mobile width and inert fixtures. No vendor calls. Separate curated practice earned exactly one idempotent First Safe Step badge; consent invalidation and zero-call purchase denial passed.');
  const worker = browser.serviceWorkers()[0] ?? await browser.waitForEvent('serviceworker', { timeout: 10000 });
  const extensionId = new URL(worker.url()).hostname;
  const popup = await browser.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.getByText('Local connection', { exact: true }).click();
  await popup.getByText('Worker ready · controlled fixtures', { exact: true }).waitFor();
  await popup.getByRole('button', { name: 'Show current-page access' }).click();
  await popup.getByText(/Page access unavailable here/).waitFor();
  console.log('PASS: actual unpacked MV3 extension loaded, real worker responded, popup rendered, manual action refused a restricted extension page.');
  console.log('MANUAL CHECK STILL REQUIRED: positive toolbar-invoked activeTab grant and content notice/dismissal on an HTTP(S) tab. A direct popup URL does not grant activeTab. See docs/FOUNDATION.md.');
} finally {
  await browser?.close();
  await Promise.all(processes.map(async child => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit'); child.kill('SIGTERM');
    await Promise.race([exited, delay(3000)]);
    if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited; }
  }));
  await rm(browserProfile, { recursive: true, force: true });
}
