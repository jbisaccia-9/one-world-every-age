import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import {
  familyBudgetModeSchema, familyBudgetRequestSchema, familyBudgetResultSchema, familyBudgetSnapshotSchema,
  type FamilyBudgetMode, type FamilyBudgetPurchase, type FamilyBudgetSnapshot,
} from '@beacon/contracts/family-budget';
import { BackendError } from './errors.js';

const ownerSchema = z.string().min(1).max(100).regex(/^[A-Za-z0-9:_-]+$/);
const policy = {
  perPurchaseMinor: 5000, monthlyMinor: 25000, currency: 'USD', timezone: 'UTC', source: 'local-sample',
  parentLink: 'unverified', parentApproval: 'unverified', realPurchases: 'blocked',
  notice: 'LOCAL SAMPLE family rule: $50 per purchase and $250 per UTC calendar month. This is not a verified parent policy. Real purchases remain blocked until parent linkage and approval are verified.',
} as const;
const catalog = [
  { id: 'ozone-layer-family-wallet', label: 'Sample cart: Ozone Layer Family', amountMinor: 1099, currency: 'USD', kind: 'sample', sample: true, productPath: 'ozone-layer-family-wallet', quantity: 1, priceCheckedAt: '2026-10-21' },
  { id: 'spark-coins-100', label: 'Sample cart: Spark Coins', amountMinor: 99, currency: 'USD', kind: 'sample', sample: true, productPath: 'spark-coins-100', quantity: 1, priceCheckedAt: '2026-10-21' },
  { id: 'family-wallet-four', label: 'Sample cart: 4 × Ozone Layer Family', amountMinor: 4396, currency: 'USD', kind: 'sample', sample: true, productPath: 'ozone-layer-family-wallet', quantity: 4, priceCheckedAt: '2026-10-21' },
  { id: 'family-wallet-five', label: 'Sample cart: 5 × Ozone Layer Family', amountMinor: 5495, currency: 'USD', kind: 'sample', sample: true, productPath: 'ozone-layer-family-wallet', quantity: 5, priceCheckedAt: '2026-10-21' },
  { id: 'verification-pack', label: 'Scam example: pay to verify your account', amountMinor: 100, currency: 'USD', kind: 'scam', sample: true },
] as const;
const notice = 'Sample accounting only. Cart prices mirror a read-only owned FastSpring test catalog lookup on 2026-10-21; preset quantities are assigned by this server. Billing and saved-method support remain unverified. Pending requests reserve the sample budget; completed simulations spend it once. No checkout, charge, paid order or entitlement is created.';
type Row = {
  id: string; owner: string; key: string; payload: string; item: typeof catalog[number]['id']; amount: number;
  mode: FamilyBudgetMode; state: FamilyBudgetPurchase['state']; reason: string; period: string;
  created: number; updated: number; expires: number; generation: number;
};
function periodAt(now: number) {
  const date = new Date(now), year = date.getUTCFullYear(), month = date.getUTCMonth();
  const starts = Date.UTC(year, month, 1), ends = Date.UTC(year, month + 1, 1);
  return { key: date.toISOString().slice(0, 7), starts, ends };
}

/** Owner IDs come only from authenticated application sessions. No vendor or client approval path exists here. */
export class FamilyBudgetStore {
  #db: DatabaseSync;
  #now: () => number;
  #ttl: number;
  #closed = false;
  constructor(path = ':memory:', options: { now?: () => number; reservationTtlMs?: number } = {}) {
    this.#now = options.now ?? Date.now;
    this.#ttl = options.reservationTtlMs ?? 15 * 60_000;
    if (!Number.isSafeInteger(this.#ttl) || this.#ttl < 1 || this.#ttl > 24 * 60 * 60_000) throw new Error('Sample reservation lifetime must be between one millisecond and one day.');
    this.#db = new DatabaseSync(path);
    this.#db.exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS family_budget_owners (
        owner TEXT PRIMARY KEY, generation INTEGER NOT NULL DEFAULT 0,
        source TEXT NOT NULL DEFAULT 'local-sample' CHECK(source='local-sample'),
        per_purchase INTEGER NOT NULL DEFAULT 5000 CHECK(per_purchase=5000),
        monthly INTEGER NOT NULL DEFAULT 25000 CHECK(monthly=25000)
      );
      CREATE TABLE IF NOT EXISTS family_budget_requests (
        id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES family_budget_owners(owner),
        key TEXT NOT NULL, payload TEXT NOT NULL, item TEXT NOT NULL,
        amount INTEGER NOT NULL CHECK(amount>=0 AND amount<=6000),
        mode TEXT NOT NULL CHECK(mode IN ('local-demo','provider-test')),
        state TEXT NOT NULL CHECK(state IN ('pending','completed','failed','cancelled','expired','blocked')),
        reason TEXT NOT NULL, period TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL,
        expires INTEGER NOT NULL, generation INTEGER NOT NULL, UNIQUE(owner,key)
      );
      CREATE INDEX IF NOT EXISTS family_budget_owner_period ON family_budget_requests(owner,generation,period,state);`);
  }
  #time() {
    const now = this.#now();
    if (!Number.isSafeInteger(now) || now < 0 || now > 253402300799999) throw new Error('Invalid sample ledger clock.');
    return now;
  }
  #transaction<T>(work: () => T): T {
    this.#db.exec('BEGIN IMMEDIATE');
    try { const result = work(); this.#db.exec('COMMIT'); return result; }
    catch (error) { this.#db.exec('ROLLBACK'); throw error; }
  }
  #owner(owner: string) {
    const row = this.#db.prepare('SELECT generation FROM family_budget_owners WHERE owner=?').get(owner) as { generation: number } | undefined;
    if (row) return row.generation;
    const count = this.#db.prepare('SELECT COUNT(*) AS n FROM family_budget_owners').get() as { n: number };
    if (count.n >= 1000) throw new BackendError(429, 'LIMITED', 'Sample family ledger owner capacity reached.');
    this.#db.prepare('INSERT INTO family_budget_owners(owner) VALUES (?)').run(owner);
    return 0;
  }
  #expire(owner: string, now: number) {
    this.#db.prepare("UPDATE family_budget_requests SET state='expired',updated=?,reason=? WHERE owner=? AND state='pending' AND expires<=?")
      .run(now, 'Sample reservation expired. Its budget was released; late completion cannot revive it.', owner, now);
  }
  #purchase(row: Row): FamilyBudgetPurchase {
    return {
      id: row.id, itemId: row.item, label: catalog.find(item => item.id === row.item)!.label,
      amountMinor: row.amount, currency: 'USD', state: row.state, mode: row.mode, source: 'local-sample', simulated: true,
      reason: row.reason, periodKey: row.period, createdAt: new Date(row.created).toISOString(),
      updatedAt: new Date(row.updated).toISOString(), expiresAt: new Date(row.expires).toISOString(),
      paid: false, fulfilled: false, checkoutCalls: 0, chargeCalls: 0,
    };
  }
  #snapshot(owner: string, mode: FamilyBudgetMode, now: number): FamilyBudgetSnapshot {
    const generation = this.#owner(owner), period = periodAt(now);
    this.#expire(owner, now);
    const sums = this.#db.prepare(`SELECT
      COALESCE(SUM(CASE WHEN state='completed' THEN amount ELSE 0 END),0) AS spent,
      COALESCE(SUM(CASE WHEN state='pending' THEN amount ELSE 0 END),0) AS pending
      FROM family_budget_requests WHERE owner=? AND (generation=? OR mode='provider-test') AND period=? AND mode=?`)
      .get(owner, generation, period.key, mode) as { spent: number; pending: number };
    const rows = this.#db.prepare("SELECT * FROM family_budget_requests WHERE owner=? AND (generation=? OR mode='provider-test') AND mode=? ORDER BY created DESC,id DESC").all(owner, generation, mode) as Row[];
    return familyBudgetSnapshotSchema.parse({
      mode, policy, period: { key: period.key, startsAt: new Date(period.starts).toISOString(), endsAt: new Date(period.ends).toISOString() },
      spentMinor: sums.spent, reservedMinor: sums.pending, availableMinor: Math.max(0, policy.monthlyMinor - sums.spent - sums.pending),
      catalog, requests: rows.map(row => this.#purchase(row)), notice,
    });
  }
  snapshot(ownerId: string, mode: FamilyBudgetMode = 'local-demo') {
    const owner = ownerSchema.parse(ownerId); familyBudgetModeSchema.parse(mode);
    return this.#transaction(() => this.#snapshot(owner, mode, this.#time()));
  }
  request(ownerId: string, input: unknown, mode: FamilyBudgetMode = 'local-demo') {
    const owner = ownerSchema.parse(ownerId), request = familyBudgetRequestSchema.parse(input); familyBudgetModeSchema.parse(mode);
    // A caller can never override catalog amounts, ownership, currency or policy provenance.
    const payload = JSON.stringify({ itemId: request.itemId, mode });
    return this.#transaction(() => {
      const now = this.#time(), snapshot = this.#snapshot(owner, mode, now), generation = this.#owner(owner);
      const prior = this.#db.prepare('SELECT * FROM family_budget_requests WHERE owner=? AND key=?').get(owner, request.idempotencyKey) as Row | undefined;
      if (prior) {
        if (prior.payload !== payload) throw new BackendError(409, 'CONFLICT', 'A sample purchase idempotency key cannot be reused for a changed request.');
        return familyBudgetResultSchema.parse({ purchase: this.#purchase(prior), snapshot });
      }
      // Retain receipts rather than evicting keys and allowing a replay to reserve again.
      const count = this.#db.prepare('SELECT COUNT(*) AS n FROM family_budget_requests WHERE owner=?').get(owner) as { n: number };
      if (count.n >= 200) throw new BackendError(429, 'LIMITED', 'Sample purchase receipt capacity reached.');
      const item = catalog.find(item => item.id === request.itemId)!;
      let state: Row['state'] = 'pending', reason = 'Sample budget reserved. Complete or cancel this simulation; no payment or entitlement is created.';
      if (item.kind === 'scam') { state = 'blocked'; reason = 'Scam example blocked: paying a verification fee does not prove an account is safe. The family budget never authorizes this request.'; }
      else if (mode !== 'local-demo') { state = 'blocked'; reason = 'Real family purchases are blocked. Verified parent linkage, parent policy and approval are unavailable. This sample rule cannot authorize provider purchases.'; }
      else if (item.amountMinor > policy.perPurchaseMinor) { state = 'blocked'; reason = 'This sample item exceeds the $50 per-purchase family limit.'; }
      else if (item.amountMinor > snapshot.availableMinor) { state = 'blocked'; reason = 'This request exceeds the $250 UTC calendar-month sample budget, including pending reservations.'; }
      const row: Row = {
        id: randomUUID(), owner, key: request.idempotencyKey, payload, item: item.id, amount: item.amountMinor,
        mode, state, reason, period: snapshot.period.key, created: now, updated: now,
        expires: Math.min(now + this.#ttl, Date.parse(snapshot.period.endsAt)), generation,
      };
      this.#db.prepare('INSERT INTO family_budget_requests VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(row.id, row.owner, row.key, row.payload, row.item, row.amount, row.mode, row.state, row.reason, row.period, row.created, row.updated, row.expires, row.generation);
      return familyBudgetResultSchema.parse({ purchase: this.#purchase(row), snapshot: this.#snapshot(owner, mode, now) });
    });
  }
  transition(ownerId: string, purchaseId: string, outcome: 'completed' | 'failed' | 'cancelled' | 'expired', source: 'local-demo') {
    const owner = ownerSchema.parse(ownerId); z.uuid().parse(purchaseId); z.enum(['completed', 'failed', 'cancelled', 'expired']).parse(outcome);
    if (source !== 'local-demo') throw new BackendError(403, 'FORBIDDEN', 'Only a local simulation may transition. Verified parent approval and provider completion are not implemented.');
    return this.#transaction(() => {
      const now = this.#time(); this.#expire(owner, now);
      const row = this.#db.prepare('SELECT * FROM family_budget_requests WHERE owner=? AND id=?').get(owner, purchaseId) as Row | undefined;
      if (!row) throw new BackendError(404, 'NOT_FOUND', 'Owned sample purchase unavailable.');
      if (row.mode !== 'local-demo') throw new BackendError(403, 'FORBIDDEN', 'Provider purchases cannot be completed using local simulation.');
      if (row.state !== 'pending') {
        if (row.state !== outcome) throw new BackendError(409, 'CONFLICT', 'A terminal sample purchase cannot be changed or revived.');
        return familyBudgetResultSchema.parse({ purchase: this.#purchase(row), snapshot: this.#snapshot(owner, row.mode, now) });
      }
      if (outcome === 'expired') throw new BackendError(409, 'CONFLICT', 'A sample reservation expires only at its server deadline.');
      const snapshot = this.#snapshot(owner, row.mode, now);
      if (row.generation !== this.#owner(owner) || row.period !== snapshot.period.key || row.amount > policy.perPurchaseMinor || snapshot.spentMinor + snapshot.reservedMinor > policy.monthlyMinor) {
        throw new BackendError(409, 'CONFLICT', 'The current sample policy no longer authorizes this reservation.');
      }
      row.state = outcome; row.updated = now;
      row.reason = outcome === 'completed'
        ? 'Sample completion recorded once against the demo budget. No checkout, charge, paid order or entitlement was created.'
        : `Sample request ${outcome}; its reservation was released. No checkout or charge was made.`;
      this.#db.prepare('UPDATE family_budget_requests SET state=?,updated=?,reason=? WHERE owner=? AND id=? AND state=?')
        .run(row.state, row.updated, row.reason, owner, row.id, 'pending');
      return familyBudgetResultSchema.parse({ purchase: this.#purchase(row), snapshot: this.#snapshot(owner, row.mode, now) });
    });
  }
  reset(ownerId: string, mode: FamilyBudgetMode = 'local-demo') {
    const owner = ownerSchema.parse(ownerId); familyBudgetModeSchema.parse(mode);
    if (mode !== 'local-demo') throw new BackendError(403, 'FORBIDDEN', 'Only the local sample budget can be reset.');
    return this.#transaction(() => {
      const now = this.#time(); this.#owner(owner);
      this.#db.prepare("UPDATE family_budget_requests SET state='cancelled',updated=?,reason=? WHERE owner=? AND mode='local-demo' AND state='pending'")
        .run(now, 'Local sample reset cancelled this reservation. Its receipt is retained so it cannot be replayed or revived.', owner);
      // Old receipts remain owner-bound and replay-safe but leave the sample display and totals.
      this.#db.prepare('UPDATE family_budget_owners SET generation=generation+1 WHERE owner=?').run(owner);
      return this.#snapshot(owner, mode, now);
    });
  }
  close() { if (!this.#closed) { this.#closed = true; this.#db.close(); } }
}
