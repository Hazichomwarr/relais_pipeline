import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * ProspectActionRowActions is a "use client" component built on
 * next/navigation's useRouter and the prospect-action Server Actions,
 * which can't run outside a mounted Next.js app router under plain
 * node:test — same constraint as ReverseLedgerEntryForm.test.ts. These
 * assertions run against the source directly instead.
 */
const source = readFileSync(
  "component/propects/prospect-action-row-actions.tsx",
  "utf8",
);

test("completes and cancels only through the Server Actions, never a direct service or Prisma call", () => {
  assert.match(source, /completeProspectActionAction\(/);
  assert.match(source, /cancelProspectActionAction\(/);
  assert.doesNotMatch(source, /prisma\./);
});

test("renders nothing when the viewer may neither complete nor cancel", () => {
  assert.match(source, /if \(!canComplete && !canCancel\)/);
  assert.match(source, /return null;/);
});

test("requires a non-trivial reason before confirming cancellation, matching the schema's 5-character minimum", () => {
  assert.match(source, /reason\.trim\(\)\.length < 5/);
});

test("cancellation reason is client input, never a hardcoded string sent to the server", () => {
  assert.match(source, /cancellationReason: reason/);
});
