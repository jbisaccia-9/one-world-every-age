import { z } from 'zod';

// Browser-safe demo contracts. Prices and policy are assigned by the server.
const id = z.string().min(1).max(100).regex(/^[A-Za-z0-9:_-]+$/);
const minor = z.number().int().nonnegative().safe();
export const familyBudgetModeSchema = z.enum(['local-demo', 'provider-test']);
export const familyBudgetItemIdSchema = z.enum(['ozone-layer-family-wallet', 'spark-coins-100', 'family-wallet-four', 'family-wallet-five', 'verification-pack']);
export const familyBudgetRequestSchema = z.object({ itemId: familyBudgetItemIdSchema, idempotencyKey: id }).strict();
// The server derives ownership and provenance. This is never parent approval.
export const familyBudgetTransitionSchema = z.object({ outcome: z.enum(['completed', 'failed', 'cancelled']) }).strict();
export const familyBudgetCatalogItemSchema = z.object({
  id: familyBudgetItemIdSchema, label: z.string().min(1).max(100), amountMinor: minor,
  currency: z.literal('USD'), kind: z.enum(['sample', 'scam']), sample: z.literal(true),
  productPath: z.enum(['ozone-layer-family-wallet', 'spark-coins-100']).optional(), quantity: z.number().int().min(1).max(5).optional(),
  priceCheckedAt: z.literal('2026-10-21').optional(),
}).strict().superRefine((item, context) => {
  if (item.kind === 'sample' ? !item.productPath || !item.quantity || !item.priceCheckedAt : item.productPath !== undefined || item.quantity !== undefined || item.priceCheckedAt !== undefined) {
    context.addIssue({ code: 'custom', message: 'Only mirrored sample carts carry a checked server product and quantity.' });
  }
});
export const familyBudgetPolicySchema = z.object({
  perPurchaseMinor: z.literal(5000), monthlyMinor: z.literal(25000), currency: z.literal('USD'),
  timezone: z.literal('UTC'), source: z.literal('local-sample'),
  parentLink: z.literal('unverified'), parentApproval: z.literal('unverified'), realPurchases: z.literal('blocked'),
  notice: z.string().min(1).max(1000),
}).strict();
export const familyBudgetPurchaseSchema = z.object({
  id: z.uuid(), itemId: familyBudgetItemIdSchema, label: z.string().min(1).max(100), amountMinor: minor,
  currency: z.literal('USD'), state: z.enum(['pending', 'completed', 'failed', 'cancelled', 'expired', 'blocked']),
  mode: familyBudgetModeSchema, source: z.literal('local-sample'), simulated: z.literal(true),
  reason: z.string().min(1).max(1000), periodKey: z.string().regex(/^\d{4}-\d{2}$/),
  createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(), expiresAt: z.iso.datetime(),
  paid: z.literal(false), fulfilled: z.literal(false), checkoutCalls: z.literal(0), chargeCalls: z.literal(0),
}).strict();
export const familyBudgetSnapshotSchema = z.object({
  mode: familyBudgetModeSchema, policy: familyBudgetPolicySchema,
  period: z.object({ key: z.string().regex(/^\d{4}-\d{2}$/), startsAt: z.iso.datetime(), endsAt: z.iso.datetime() }).strict(),
  spentMinor: minor, reservedMinor: minor, availableMinor: minor,
  catalog: z.array(familyBudgetCatalogItemSchema).max(5), requests: z.array(familyBudgetPurchaseSchema).max(200),
  notice: z.string().min(1).max(1000),
}).strict();
export const familyBudgetResultSchema = z.object({ purchase: familyBudgetPurchaseSchema, snapshot: familyBudgetSnapshotSchema }).strict();
export type FamilyBudgetMode = z.infer<typeof familyBudgetModeSchema>;
export type FamilyBudgetPurchase = z.infer<typeof familyBudgetPurchaseSchema>;
export type FamilyBudgetSnapshot = z.infer<typeof familyBudgetSnapshotSchema>;
export type FamilyBudgetResult = z.infer<typeof familyBudgetResultSchema>;
