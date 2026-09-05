import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * This service touches Prisma directly (import "server-only"), so it
 * can't be exercised under plain node:test without a live database
 * connection — asserted against the source, the same convention this
 * repo already uses (see sales-funnel-analytics.service.test.ts,
 * prospect-action-queue.service.test.ts). The meaningful domain-logic
 * coverage lives in prospect-assignment-transfer.service-core.test.ts,
 * exercised against a fake in-memory transactional store.
 */
const source = readFileSync(
  "src/services/prospect-assignment-transfer.service.ts",
  "utf8",
);

test("reassignProspect wraps both the guarded update and the history insert in one prisma.$transaction — ownership change and transfer row are atomic (Ticket 28B §27)", () => {
  const functionBody = source.slice(
    source.indexOf("export async function reassignProspect("),
    source.indexOf("const transferWithUsersSelect"),
  );
  assert.match(functionBody, /prisma\.\$transaction\(/);
  assert.match(functionBody, /reassignAtomically/);
  assert.match(functionBody, /recordTransfer/);
});

test("the concurrency guard passes assignedUserId: expectedCurrentOwnerId literally, never conditionally spread away — a null current owner must still guard the write (Ticket 28B §4/§28-30)", () => {
  const guardIndex = source.indexOf("reassignAtomically: async");
  const guardBody = source.slice(guardIndex, source.indexOf("recordTransfer:"));
  assert.match(guardBody, /where:\s*\{\s*\n?\s*id:\s*prospectId,\s*\n?\s*assignedUserId:\s*expectedCurrentOwnerId,?\s*\n?\s*\}/);
  // Never conditionally spread — that would silently drop the guard when
  // expectedCurrentOwnerId is null instead of producing "IS NULL".
  assert.doesNotMatch(guardBody, /\.\.\.\(expectedCurrentOwnerId/);
});

test("reassignAtomically uses updateMany (a conditional, count-checkable write), never a blind update", () => {
  const guardIndex = source.indexOf("reassignAtomically: async");
  const guardBody = source.slice(guardIndex, source.indexOf("recordTransfer:"));
  assert.match(guardBody, /tx\.prospect\.updateMany\(/);
  assert.doesNotMatch(guardBody, /tx\.prospect\.update\(/);
});

test("findActor and findTarget both re-resolve fresh from the database inside the same transaction — neither is a value threaded in from the caller's session", () => {
  assert.match(source, /findActor:\s*\(id\)\s*=>\s*\n?\s*tx\.user\.findUnique/);
  assert.match(source, /findTarget:\s*\(id\)\s*=>\s*\n?\s*tx\.user\.findUnique/);
});

test("never accepts fromUserId, changedByUserId, or occurredAt from the caller — recordTransfer's fields all come from reassignProspectCore's own derivation, and the reassignment function itself never overrides or supplies any of them", () => {
  const reassignFunctionBody = source.slice(
    source.indexOf("export async function reassignProspect("),
    source.indexOf("const transferWithUsersSelect"),
  );
  assert.doesNotMatch(reassignFunctionBody, /fromUserId:\s*input/);
  assert.doesNotMatch(reassignFunctionBody, /changedByUserId:\s*input/);
  assert.doesNotMatch(reassignFunctionBody, /occurredAt:/);
});

test("getProspectAssignmentTransfers orders newest-first and selects reason — not gated by role in this file, so the caller (28C) must gate detailed reason history to ADMIN/MANAGER before rendering it (Ticket 28B §41/§42)", () => {
  assert.match(source, /export async function getProspectAssignmentTransfers/);
  assert.match(source, /orderBy:\s*\{\s*occurredAt:\s*"desc"\s*\}/);
  assert.match(source, /reason:\s*true/);
});

test("never mutates ProspectActivity or ProspectAction — this service touches only Prospect and ProspectAssignmentTransfer", () => {
  assert.doesNotMatch(source, /prospectActivity\.(create|update|updateMany)/);
  assert.doesNotMatch(source, /prospectAction\.(create|update|updateMany)/);
});

test("never fabricates a legacy backfill — no seed/backfill helper of any kind in this file", () => {
  assert.doesNotMatch(source, /backfill/i);
  assert.doesNotMatch(source, /seed/i);
});
