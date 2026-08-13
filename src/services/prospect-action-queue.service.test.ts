import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * This service touches Prisma directly (import "server-only"), so it
 * can't be exercised under plain node:test without a live database
 * connection — asserted against the source instead, following the
 * repository's established convention for this kind of check (see
 * financial-ledger.service.ts's equivalent coverage).
 */
const source = readFileSync("src/services/prospect-action-queue.service.ts", "utf8");

function extractFunctionBody(functionName: string): string {
  const start = source.indexOf(`function ${functionName}`);
  assert.ok(start >= 0, `could not find function ${functionName}`);
  const nextExportIndex = source.indexOf("\nexport ", start + 1);
  return nextExportIndex === -1 ? source.slice(start) : source.slice(start, nextExportIndex);
}

test("listProspectActionQueue issues exactly one bounded findMany, not a query per row/bucket/employee", () => {
  const body = extractFunctionBody("listProspectActionQueue");
  const findManyCalls = body.match(/\.findMany\(/g) ?? [];
  assert.equal(findManyCalls.length, 1);
});

test("listActiveProspectsWithoutOpenAction issues exactly one bounded findMany", () => {
  const body = extractFunctionBody("listActiveProspectsWithoutOpenAction");
  const findManyCalls = body.match(/\.findMany\(/g) ?? [];
  assert.equal(findManyCalls.length, 1);
});

test("bucket counts and bucket filtering are derived in memory from the same result set, never queried separately per bucket", () => {
  assert.match(source, /summarizeProspectActionQueue\(/);
  assert.match(source, /filterProspectActionQueueByBucket\(/);
  assert.doesNotMatch(source, /count\(\{[\s\S]*bucket/i);
});

test("the queue select excludes ProspectActivity history and Prospect.notes as Prisma select keys", () => {
  assert.doesNotMatch(source, /activities:\s*true/);
  assert.doesNotMatch(source, /\bnotes:\s*true/);
});

test("crack detection uses a single relation anti-join, not an application-level per-prospect existence check", () => {
  assert.match(source, /actions:\s*\{\s*none:\s*\{\s*status:\s*"OPEN"\s*\}\s*\}/);
});

test("never mutates a ProspectAction, Prospect, or ProspectActivity — this is a read-only service; 20B remains the sole mutation authority", () => {
  assert.doesNotMatch(source, /\.update\(/);
  assert.doesNotMatch(source, /\.create\(/);
  assert.doesNotMatch(source, /\.updateMany\(/);
  assert.doesNotMatch(source, /\$transaction/);
});
