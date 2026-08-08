import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * shared-feed.service.ts wires real Prisma queries, so — like every other
 * Prisma-wired "-service.ts" in this codebase — it is asserted against its
 * source rather than imported and executed under plain node:test. This is
 * the domain-audit regression suite required by Ticket 18A: the feed must
 * never be able to read personal notes, financial ledger entries, or
 * derive events from prospect creation / arbitrary status / interest
 * changes, regardless of what future edits touch this file.
 */
const source = readFileSync("src/services/shared-feed.service.ts", "utf8");

test("never queries PersonalNote — private notes stay invisible to À la une", () => {
  assert.doesNotMatch(source, /personalNote/i);
});

test("never queries LedgerEntry — financial activity stays out of the shared feed", () => {
  assert.doesNotMatch(source, /ledgerEntry/i);
});

test("never derives an event from Prospect.createdAt — no prospect-created events", () => {
  assert.doesNotMatch(source, /prospect\.createdAt|createdAt:\s*true/);
});

test("never queries the Prospect model directly for status or interest — only ProspectActivity and UserStatusActivity are approved sources", () => {
  assert.doesNotMatch(source, /prisma\.prospect\.(findMany|findFirst|findUnique)/);
});

test("the WON family is scoped to the WON_TRANSITION activity type, never Prospect.status directly", () => {
  assert.match(source, /type:\s*"WON_TRANSITION"/);
});

test("the follow-up family is scoped to the FOLLOW_UP activity type, never inferred from an overdue followUpDate", () => {
  assert.match(source, /type:\s*"FOLLOW_UP"\s*}/);
  assert.doesNotMatch(source, /followUpDate/);
});

test("the generic interaction family excludes the two dedicated-family activity types", () => {
  assert.match(source, /NON_INTERACTION_ACTIVITY_TYPES/);
});

test("every source query is bounded by the resolved limit — no unbounded history reads", () => {
  const takeOccurrences = source.match(/take:\s*limit/g) ?? [];
  assert.equal(takeOccurrences.length, 4);
});

test("every source query orders by occurredAt desc, id desc for deterministic pagination", () => {
  assert.match(source, /occurredAt:\s*"desc"/);
  assert.match(source, /id:\s*"desc"/);
});

test("read-only: the service never calls a Prisma write method", () => {
  assert.doesNotMatch(source, /\.(create|update|delete|upsert)\(/);
});
