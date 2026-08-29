import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * A "use client" react-hook-form + useRouter component — cannot render
 * under plain node:test (same constraint as LedgerEntryForm.test.ts).
 * These assertions run against the source directly.
 */
const source = readFileSync(
  "component/admin/CommercialPerformanceTargetForm.tsx",
  "utf8",
);

test("validates against the Ticket 25H.2A schema via zodResolver, never redefines validation rules", () => {
  assert.match(source, /zodResolver\(createCommercialPerformanceTargetSchema\)/);
});

test("submits through createCommercialPerformanceTargetAction, never a direct service or Prisma call", () => {
  assert.match(source, /createCommercialPerformanceTargetAction\(/);
  assert.doesNotMatch(source, /from "@\/src\/lib\/prisma"/);
});

test("defaults to next month, never the current or a past month — this month is already locked by the time the form can be used", () => {
  assert.match(source, /nextMonthDefaults/);
  assert.doesNotMatch(source, /getUTCMonth\(\)\s*\+\s*0\b/);
});

test("the employee select is populated from the eligibleEmployees prop, not a hardcoded list", () => {
  assert.match(source, /eligibleEmployees\.map\(/);
});

test("Ticket 25P §34: the select label reflects both eligible roles, not Commercial-only", () => {
  assert.match(source, /Commercial ou manager/);
});
