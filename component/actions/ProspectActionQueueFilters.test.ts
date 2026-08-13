import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * ProspectActionQueueFilters is a "use client" component built on
 * next/navigation's useRouter/useSearchParams, which can't run outside a
 * mounted Next.js app router under plain node:test — same constraint as
 * FollowUpFilters and LedgerEntryForm.test.ts.
 */
const source = readFileSync("component/actions/ProspectActionQueueFilters.tsx", "utf8");

test("scope, bucket, assignee, and product all update the URL via the shared param helper, never a hardcoded per-field URL builder", () => {
  assert.match(source, /import\s*\{[^}]*updateProspectActionQueueParam[^}]*\}\s*from\s*"@\/src\/lib\/prospect-action-queue-filters"/);
  assert.match(source, /updateParameter\("scope", /);
  assert.match(source, /updateParameter\("assignee", /);
  assert.match(source, /updateParameter\("product", /);
  assert.match(source, /updateParameter\("bucket", /);
});

test("does not add filters explicitly excluded from V1 (outcome, reason, interest, prospect status, created by, action status, date range)", () => {
  for (const forbidden of [
    "conversionOutcome",
    "conversionReason",
    "interest",
    "prospectStatus",
    "createdBy",
    "dateRange",
  ]) {
    assert.doesNotMatch(source, new RegExp(forbidden));
  }
});

test("the assignee dropdown is populated from the assignableUsers prop, never a hardcoded role filter", () => {
  assert.match(source, /assignableUsers\.map\(/);
  assert.doesNotMatch(source, /role === "COMMERCIAL"/);
});

test("the product dropdown uses the centralized product options, never a hardcoded list", () => {
  assert.match(source, /import\s*\{[^}]*productOptions[^}]*\}\s*from\s*"@\/src\/lib\/constants\/prospect-options"/);
  assert.match(source, /productOptions\.map\(/);
});

test("reset navigates to the bare /actions route, clearing every filter at once", () => {
  assert.match(source, /router\.push\("\/actions"\)/);
});
