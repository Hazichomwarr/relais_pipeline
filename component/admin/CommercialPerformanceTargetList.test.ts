import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * A "use client" component using useRouter — cannot render under plain
 * node:test (same constraint as LedgerEntryForm.test.ts). These
 * assertions run against the source directly.
 */
const source = readFileSync(
  "component/admin/CommercialPerformanceTargetList.tsx",
  "utf8",
);

test("deletes through deleteCommercialPerformanceTargetAction, never a direct service or Prisma call", () => {
  assert.match(source, /deleteCommercialPerformanceTargetAction\(/);
  assert.doesNotMatch(source, /from "@\/src\/lib\/prisma"/);
});

test("the delete control is only rendered for an unlocked target — a locked target has no mutation affordance", () => {
  assert.match(source, /target\.locked \? null : \(/);
});

test("locked and editable states use distinct visual labels, not a raw boolean", () => {
  assert.match(source, /Objectif verrouillé/);
  assert.match(source, /Modifiable/);
});

test("no client-supplied score/formula language leaks into this V1 evidence-only surface", () => {
  assert.doesNotMatch(source, /\/\s*40/);
  assert.doesNotMatch(source, /score/i);
});
