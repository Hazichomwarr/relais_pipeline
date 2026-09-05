import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * This service touches Prisma directly (import "server-only"), so it
 * can't be exercised under plain node:test without a live database
 * connection — asserted against the source, following the repository's
 * established convention (see prospect-action-queue.service.test.ts).
 */
const source = readFileSync("src/services/sales-funnel-analytics.service.ts", "utf8");

test("issues exactly three bounded queries — Prospect cohort, structured-outcome read, historical WON/LOST attribution (Ticket 28A.1) — never one per product/owner/status", () => {
  const findManyCalls = source.match(/\.findMany\(/g) ?? [];
  assert.equal(findManyCalls.length, 3);
});

test("the pipeline cohort filters Prospect.createdAt by the period; the outcome query filters ProspectActivity.occurredAt by the same period — never the other way around", () => {
  const cohortWhereIndex = source.indexOf("const prospectCohortWhere");
  const productWhereIndex = source.indexOf("const prospectProductWhere");
  assert.ok(cohortWhereIndex >= 0 && productWhereIndex >= 0);

  const cohortWhereBlock = source.slice(cohortWhereIndex, productWhereIndex);
  assert.match(cohortWhereBlock, /createdAt:\s*dateRange/);

  const prospectFindManyIndex = source.indexOf("prisma.prospect.findMany");
  const firstActivityIndex = source.indexOf("prisma.prospectActivity.findMany");
  assert.ok(prospectFindManyIndex >= 0 && prospectFindManyIndex < firstActivityIndex);

  const outcomeCallEnd = source.indexOf("prisma.prospectActivity.findMany", firstActivityIndex + 1);
  const outcomeCall = source.slice(firstActivityIndex, outcomeCallEnd);
  assert.match(outcomeCall, /occurredAt:\s*dateRange/);
  assert.doesNotMatch(outcomeCall, /createdAt:\s*dateRange/);
});

test("the outcome query only reads structured FOLLOW_UP rows with a non-null conversionOutcome — legacy activities are excluded, never classified", () => {
  const activityCallIndex = source.indexOf("prisma.prospectActivity.findMany");
  const activityCall = source.slice(activityCallIndex);
  assert.match(activityCall, /type:\s*"FOLLOW_UP"/);
  assert.match(activityCall, /conversionOutcome:\s*\{\s*not:\s*null\s*\}/);
});

test("Ticket 28A.1: product filters apply to the outcome query through the Prospect relation; the owner filter applies directly via responsibleUserIdAtEvent, never through the current Prospect.assignedUserId relation", () => {
  assert.match(source, /prospectProductWhere/);
  const activityCallIndex = source.indexOf("prisma.prospectActivity.findMany");
  const nextActivityCallIndex = source.indexOf("prisma.prospectActivity.findMany", activityCallIndex + 1);
  const outcomeCall = source.slice(activityCallIndex, nextActivityCallIndex);
  assert.match(outcomeCall, /prospect:\s*prospectProductWhere/);
  assert.match(outcomeCall, /responsibleUserIdAtEvent:\s*filters\.ownerUserId/);
  assert.doesNotMatch(outcomeCall, /assignedUserId:\s*filters\.ownerUserId/);
});

test("Ticket 28A.1: the historical WON/LOST query scopes owner-filtering through creditedUserId (WON) and responsibleUserIdAtEvent (LOST), never through Prospect.assignedUserId", () => {
  const historicalCallIndex = source.lastIndexOf("prisma.prospectActivity.findMany");
  const historicalCall = source.slice(historicalCallIndex);
  assert.match(historicalCall, /type:\s*"WON_TRANSITION"/);
  assert.match(historicalCall, /creditedUserId:\s*filters\.ownerUserId/);
  assert.match(historicalCall, /conversionOutcome:\s*"LOST"/);
  assert.match(historicalCall, /responsibleUserIdAtEvent:\s*filters\.ownerUserId/);
  assert.match(historicalCall, /prospect:\s*prospectCohortWhere/);
  assert.doesNotMatch(historicalCall, /assignedUserId:\s*filters\.ownerUserId/);
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

test("Ticket 28A.1: never falls back from missing historical attribution to the current Prospect.assignedUserId relation", () => {
  assert.doesNotMatch(source, /responsibleUserIdAtEvent\s*\?\?/);
  assert.doesNotMatch(source, /creditedUserId\s*\?\?\s*.*assignedUserId/);
});
