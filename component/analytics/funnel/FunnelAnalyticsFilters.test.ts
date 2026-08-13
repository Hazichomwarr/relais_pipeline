import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * FunnelAnalyticsFilters is a "use client" component built on
 * next/navigation's useRouter/useSearchParams, which can't run outside a
 * mounted Next.js app router under plain node:test — same constraint as
 * ProspectActionQueueFilters.test.ts.
 */
const source = readFileSync("component/analytics/funnel/FunnelAnalyticsFilters.tsx", "utf8");

test("supports exactly period, product, and owner filters — V1 scope, nothing more", () => {
  assert.match(source, /updateParameter\("period", /);
  assert.match(source, /updateParameter\("product", /);
  assert.match(source, /updateParameter\("owner", /);
});

test("does not add filters explicitly deferred to later tickets (reason, outcome, interest, status, action owner)", () => {
  for (const forbidden of [
    "conversionOutcome",
    "conversionReason",
    '"interest"',
    '"status"',
    "actionOwner",
  ]) {
    assert.doesNotMatch(source, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("the product dropdown uses the centralized product options, never a hardcoded list", () => {
  assert.match(source, /import\s*\{[^}]*productOptions[^}]*\}\s*from\s*"@\/src\/lib\/constants\/prospect-options"/);
  assert.match(source, /productOptions\.map\(/);
});

test("the owner dropdown is populated from the owners prop — not filtered to a formal role, so ADMIN/MANAGER prospect owners can be selected", () => {
  assert.match(source, /owners\.map\(/);
  assert.doesNotMatch(source, /role === "COMMERCIAL"/);
});

test("reset navigates to the bare funnel analytics route, clearing every filter at once", () => {
  assert.match(source, /router\.push\("\/admin\/analytics\/funnel"\)/);
});
