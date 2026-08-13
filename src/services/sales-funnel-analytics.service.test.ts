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

test("issues exactly two bounded queries — one Prospect cohort, one structured-outcome read — never one per product/owner/status", () => {
  const findManyCalls = source.match(/\.findMany\(/g) ?? [];
  assert.equal(findManyCalls.length, 2);
});

test("the pipeline cohort filters Prospect.createdAt by the period; the outcome query filters ProspectActivity.occurredAt by the same period — never the other way around", () => {
  const prospectWhereIndex = source.indexOf("const prospectWhere");
  const relationWhereIndex = source.indexOf("const prospectRelationWhere");
  assert.ok(prospectWhereIndex >= 0 && relationWhereIndex >= 0);

  const prospectWhereBlock = source.slice(prospectWhereIndex, relationWhereIndex);
  assert.match(prospectWhereBlock, /createdAt:\s*dateRange/);
  assert.doesNotMatch(prospectWhereBlock, /occurredAt/);

  const activityCallIndex = source.indexOf("prisma.prospectActivity.findMany");
  const activityCall = source.slice(activityCallIndex);
  assert.match(activityCall, /occurredAt:\s*dateRange/);
  assert.doesNotMatch(activityCall, /createdAt:\s*dateRange/);
});

test("the outcome query only reads structured FOLLOW_UP rows with a non-null conversionOutcome — legacy activities are excluded, never classified", () => {
  const activityCallIndex = source.indexOf("prisma.prospectActivity.findMany");
  const activityCall = source.slice(activityCallIndex);
  assert.match(activityCall, /type:\s*"FOLLOW_UP"/);
  assert.match(activityCall, /conversionOutcome:\s*\{\s*not:\s*null\s*\}/);
});

test("product/owner filters apply to the outcome query through the Prospect relation, not through Prospect.createdAt", () => {
  assert.match(source, /prospectRelationWhere/);
  const activityCallIndex = source.indexOf("prisma.prospectActivity.findMany");
  const activityCall = source.slice(activityCallIndex);
  assert.match(activityCall, /prospect:\s*prospectRelationWhere/);
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
