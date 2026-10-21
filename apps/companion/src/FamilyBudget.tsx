import { useEffect, useRef, useState } from 'react';
import { ownedAssessmentResponseSchema } from '@beacon/contracts';
import { familyBudgetResultSchema, familyBudgetSnapshotSchema, type FamilyBudgetSnapshot } from '@beacon/contracts/family-budget';
import { openSession, type Client } from './demo-client';

type BudgetSession = { client: Client; assessmentId: string; contextVersion: number };
type Reservation = { contextVersion: number; assessmentId: string; itemId: string; idempotencyKey: string };
const money = (minor: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(minor / 100);

export function FamilyBudget() {
  const [snapshot, setSnapshot] = useState<FamilyBudgetSnapshot | null>(null);
  const [itemId, setItemId] = useState('family-wallet-four');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState(false);
  const owned = useRef<BudgetSession | null>(null);
  const pending = useRef<Reservation | null>(null);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; controller.current?.abort(); owned.current?.client.close(); owned.current = null; }, []);

  async function start() {
    if (busy || owned.current) return;
    const current = ++generation.current, abort = new AbortController(); controller.current = abort;
    let client: Client | undefined;
    setBusy(true); setMessage('Opening Jimmy’s separate local sample budget…');
    try {
      client = await openSession('local-demo', 'child');
      if (generation.current !== current || abort.signal.aborted) { client.close(); return; }
      const contextVersion = client.session.contextVersion;
      const assessment = ownedAssessmentResponseSchema.parse(await client.request('/api/assessments', { contextVersion, fixtureId: 'P01', variant: 'baseline' }, abort.signal));
      if (assessment.assessment.ownerId !== client.session.ownerId || assessment.assessment.contextVersion !== contextVersion || assessment.assessment.mode !== 'local-demo') throw new Error('The sample assessment changed.');
      const value = familyBudgetSnapshotSchema.parse(await client.request('/api/family-budget', undefined, abort.signal));
      if (generation.current !== current || abort.signal.aborted) { client.close(); return; }
      owned.current = { client, assessmentId: assessment.assessment.id, contextVersion };
      setSnapshot(value); setMessage('Sample budget ready. A reservation uses the sample allowance; it does not buy an item.');
    } catch {
      client?.close();
      if (generation.current === current && !abort.signal.aborted) setMessage('The sample budget could not load. Start the local API and try again.');
    } finally { if (generation.current === current) { setBusy(false); controller.current = null; } }
  }

  async function reserve(retryLast = false) {
    const session = owned.current;
    if (!session || busy || (pending.current && !retryLast)) return;
    const current = generation.current, abort = new AbortController(); controller.current = abort;
    const body = retryLast && pending.current ? pending.current : { contextVersion: session.contextVersion, assessmentId: session.assessmentId, itemId, idempotencyKey: crypto.randomUUID() };
    pending.current = body; setBusy(true); setMessage('Checking the sample policy and reserving on the server…');
    try {
      const result = familyBudgetResultSchema.parse(await session.client.request('/api/family-budget/requests', body, abort.signal));
      if (generation.current !== current || abort.signal.aborted) return;
      pending.current = null; setRetry(false); setSnapshot(result.snapshot);
      setMessage(`${result.purchase.state === 'pending' ? 'Sample reservation allowed' : 'Sample request ' + result.purchase.state}: ${result.purchase.reason} No payment, checkout or item delivery occurred.`);
    } catch {
      if (generation.current === current && !abort.signal.aborted) { setRetry(true); setMessage('The result could not be confirmed. Retry the same sample request to reconcile it; the request key stays the same.'); }
    } finally { if (generation.current === current) { setBusy(false); controller.current = null; } }
  }

  async function transition(id: string, action: 'cancel' | 'completed' | 'failed') {
    const session = owned.current; if (!session || busy || pending.current) return;
    const current = generation.current, abort = new AbortController(); controller.current = abort;
    setBusy(true); setMessage('Updating this sample reservation…');
    try {
      const result = familyBudgetResultSchema.parse(await session.client.request(`/api/family-budget/requests/${encodeURIComponent(id)}/${action === 'cancel' ? 'cancel' : 'simulate'}`, { contextVersion: session.contextVersion, ...(action === 'cancel' ? {} : { outcome: action }) }, abort.signal));
      if (generation.current !== current || abort.signal.aborted) return;
      setSnapshot(result.snapshot); setMessage(`Sample ${result.purchase.state}: ${result.purchase.reason} No payment or item delivery occurred.`);
    } catch { if (generation.current === current && !abort.signal.aborted) setMessage('The sample update could not be confirmed. Refresh the sample budget before trying again.'); }
    finally { if (generation.current === current) { setBusy(false); controller.current = null; } }
  }

  async function refreshOrReset(reset = false) {
    const session = owned.current; if (!session || busy || pending.current) return;
    const current = generation.current, abort = new AbortController(); controller.current = abort;
    setBusy(true);
    try {
      const value = familyBudgetSnapshotSchema.parse(await session.client.request(`/api/family-budget${reset ? '/reset' : ''}`, reset ? { contextVersion: session.contextVersion } : undefined, abort.signal));
      if (generation.current !== current || abort.signal.aborted) return;
      setSnapshot(value); setMessage(reset ? 'This local sample budget was reset. Learning progress and other sessions were kept.' : 'Sample budget refreshed.');
    } catch { if (generation.current === current && !abort.signal.aborted) setMessage('The sample budget is unavailable. No successful update was confirmed.'); }
    finally { if (generation.current === current) { setBusy(false); controller.current = null; } }
  }

  const selected = snapshot?.catalog.find(item => item.id === itemId);
  return <section className="family-budget" aria-labelledby="family-budget-heading">
    <div className="budget-heading"><div><p className="eyebrow">JIMMY / PAUSE BEFORE A PURCHASE</p><h2 id="family-budget-heading">A family budget to practice with.</h2></div><span className="tag">Local sample · no payments</span></div>
    <p>A sample family policy allows up to <strong>$50 per purchase</strong> and <strong>$250 per calendar month, UTC</strong>. These are demo settings. A linked parent and vendor approval are unverified; actual checkout stays unavailable.</p>
    <p className="budget-warning"><strong>A small price does not make an offer trustworthy.</strong> Jimmy’s verification pack is blocked for its scam evidence, even at $1. Secrecy and paying for “free” credits deserve a pause.</p>
    {!snapshot ? <button className="budget-action" disabled={busy} onClick={() => void start()}>{busy ? 'Opening sample budget…' : 'Open Jimmy’s sample budget'}</button> : <>
      <dl className="budget-totals" data-testid="family-budget-totals"><div><dt>Sample spent</dt><dd>{money(snapshot.spentMinor)}</dd></div><div><dt>Sample reserved</dt><dd>{money(snapshot.reservedMinor)}</dd></div><div><dt>Sample available</dt><dd>{money(snapshot.availableMinor)}</dd></div></dl>
      <p className="note">{snapshot.notice}</p>
      <p className="note">Sample cart prices mirror a read-only test catalog lookup. Billing and saved-method support are unverified. This exercise records sample allowance only.</p>
      <div className="budget-request"><label htmlFor="sample-catalog">Choose a sample catalog item<select id="sample-catalog" value={itemId} disabled={busy || retry} onChange={event => setItemId(event.target.value)}>{snapshot.catalog.map(item => <option key={item.id} value={item.id}>{item.label} · {money(item.amountMinor)}</option>)}</select></label><button className="budget-action" disabled={busy || retry || !selected} onClick={() => void reserve()}>{busy ? 'Checking…' : selected?.id === 'verification-pack' ? 'Check the verification-pack offer' : 'Request sample reservation'}</button></div>
      {retry && <button disabled={busy} onClick={() => void reserve(true)}>Retry last sample request</button>}
      <p className="note">A permitted sample reservation sets aside allowance only. Simulated completion moves that amount into sample spending. Cancellation or failure releases it. Reservations expire automatically after 15 minutes or at the next UTC month boundary, whichever comes first. No vendor checkout, payment or entitlement is created.</p>
      {snapshot.requests.length > 0 && <div className="budget-history"><h3>This sample session</h3><ul>{snapshot.requests.map(request => <li key={request.id}><div><strong>{request.label}</strong><span>{money(request.amountMinor)} · {request.state === 'completed' ? 'simulated completion' : 'sample ' + request.state}</span><p>{request.reason}</p>{request.state === 'pending' && <p className="note">Expires at {new Date(request.expiresAt).toLocaleString('en-US', { timeZone: 'UTC' })} UTC.</p>}</div>{request.state === 'pending' && <div className="budget-row-actions"><button disabled={busy || retry} onClick={() => void transition(request.id, 'cancel')}>Cancel reservation</button><details><summary>Simulate an outcome</summary><p>Local accounting exercise only. Nothing is purchased.</p><button disabled={busy || retry} onClick={() => void transition(request.id, 'completed')}>Simulate completion</button><button disabled={busy || retry} onClick={() => void transition(request.id, 'failed')}>Simulate failure</button></details></div>}</li>)}</ul></div>}
      <div className="budget-tools"><button disabled={busy || retry} onClick={() => void refreshOrReset()}>Refresh sample budget</button><button disabled={busy || retry} onClick={() => void refreshOrReset(true)}>Reset this sample budget</button></div>
    </>}
    <p role="status" data-testid="family-budget-result" className="note">{message || 'A separate in-memory local-demo session is created when you open this sample. No credentials or payment details are stored in the browser.'}</p>
  </section>;
}
