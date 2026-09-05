import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * This service touches Prisma directly (import "server-only"), so it can't
 * be exercised under plain node:test without a live database connection —
 * asserted against the source, same convention as
 * sales-funnel-analytics.service.test.ts.
 */
const source = readFileSync("src/services/sales-why-analytics.service.ts", "utf8");

test("issues exactly one bounded query — never one per reason/outcome/product/owner", () => {
  const findManyCalls = source.match(/\.findMany\(/g) ?? [];
  assert.equal(findManyCalls.length, 1);
});

test("filters by ProspectActivity.occurredAt, never Prospect.createdAt/updatedAt", () => {
  assert.match(source, /occurredAt:\s*dateRange/);
  assert.doesNotMatch(source, /createdAt:\s*dateRange/);
  assert.doesNotMatch(source, /Prospect\.updatedAt/);
});

test("only reads structured FOLLOW_UP rows with non-null conversionOutcome and conversionReason", () => {
  assert.match(source, /type:\s*"FOLLOW_UP"/);
  assert.match(source, /conversionReason:\s*\{\s*not:\s*null\s*\}/);
  assert.match(source, /conversionOutcome:\s*filters\.outcome/);
});

test("product filters apply through the Prospect relation", () => {
  assert.match(source, /prospectRelationWhere/);
  assert.match(source, /prospect:\s*prospectRelationWhere/);
});

test("Ticket 28A.1: the owner filter applies directly via responsibleUserIdAtEvent, never assignedUserId as a Prisma filter value", () => {
  assert.match(source, /responsibleUserIdAtEvent:\s*filters\.ownerUserId/);
  assert.doesNotMatch(source, /assignedUserId:\s*(filters\.ownerUserId|true)/);
});

test("Ticket 28A.1: selects the event's own frozen responsibility, never the prospect's assignedUser relation", () => {
  assert.match(source, /responsibleUserIdAtEvent:\s*true/);
  assert.match(source, /responsibleUserAtEvent:\s*\{/);
  assert.doesNotMatch(source, /assignedUser:\s*\{/);
});

test("selects conversionReasonNote directly — no PersonalNote or Prospect.notes query", () => {
  assert.match(source, /conversionReasonNote:\s*true/);
  assert.doesNotMatch(source, /personalNote/i);
  assert.doesNotMatch(source, /prospect\.notes/i);
});

test("never mutates a Prospect or ProspectActivity — this is a read-only analytics service", () => {
  assert.doesNotMatch(source, /\.update\(/);
  assert.doesNotMatch(source, /\.create\(/);
  assert.doesNotMatch(source, /\.updateMany\(/);
  assert.doesNotMatch(source, /\$transaction/);
});

test("never fabricates historical data — no backfill helper, no heuristic classification of legacy null outcomes", () => {
  assert.doesNotMatch(source, /backfill/i);
  assert.doesNotMatch(source, /conversionOutcome\s*\?\?/);
  assert.doesNotMatch(source, /conversionOutcome\s*\|\|/);
});

test("reuses resolveSalesFunnelPeriod rather than a second period implementation", () => {
  assert.match(source, /resolveSalesFunnelPeriod\(/);
});
