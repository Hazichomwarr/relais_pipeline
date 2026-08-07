import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * LedgerEntryForm is a "use client" component built on react-hook-form's
 * useForm/useWatch and next/navigation's useRouter, neither of which can
 * run outside a mounted Next.js app router under plain node:test (same
 * constraint documented in src/actions/authorization-order.test.ts and
 * app/notes/notes-authorization.test.ts). These assertions run against
 * the source directly instead of rendering the component.
 */
const source = readFileSync("component/finances/LedgerEntryForm.tsx", "utf8");

test("category options are chosen from the type prop, never hand-duplicated", () => {
  assert.match(
    source,
    /type === "INFLOW" \? inflowCategoryOptions : outflowCategoryOptions/,
  );
  assert.match(
    source,
    /import\s*\{[^}]*inflowCategoryOptions[^}]*outflowCategoryOptions[^}]*\}\s*from\s*"@\/src\/lib\/financial-ledger-options"/,
  );
});

test("the product field's required/optional/forbidden state is read from the shared options helper, never re-derived", () => {
  assert.match(source, /getProductRequirementForCategory\(/);
  assert.match(
    source,
    /import\s*\{[^}]*getProductRequirementForCategory[^}]*\}\s*from\s*"@\/src\/lib\/financial-ledger-options"/,
  );
});

test("changing category away from a product-compatible one clears the product field", () => {
  assert.match(
    source,
    /productRequirement === "forbidden"[\s\S]{0,80}setValue\("product", ""\)/,
  );
});

test("the product select uses the centralized RELAIS product options, not a duplicated label list", () => {
  assert.match(
    source,
    /import\s*\{\s*productOptions\s*\}\s*from\s*"@\/src\/lib\/constants\/prospect-options"/,
  );
  assert.match(source, /productOptions\.map\(/);
});

test("amount stays a string field with a numeric input hint, never Number()-converted", () => {
  assert.match(source, /inputMode="numeric"/);
  assert.match(source, /register\("amount"\)/);
  assert.doesNotMatch(source, /Number\(/);
});

test("validates against the Ticket 17A schema via zodResolver, never redefines validation rules", () => {
  assert.match(source, /zodResolver\(financialLedgerEntrySchema\)/);
});

test("submits through createLedgerEntryAction, never a direct service or Prisma call", () => {
  assert.match(source, /createLedgerEntryAction\(/);
  assert.doesNotMatch(source, /prisma\./);
});

test("occurredAt defaults to today and reference stays optional", () => {
  assert.match(source, /occurredAt: todayIsoDate\(\)/);
  assert.match(source, /label="Référence"[\s\S]{0,120}optional/);
});
