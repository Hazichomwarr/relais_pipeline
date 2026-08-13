import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * WhyAnalyticsFilters is a "use client" component built on next/navigation's
 * useRouter/useSearchParams, which can't run outside a mounted Next.js app
 * router under plain node:test — same constraint as
 * FunnelAnalyticsFilters.test.ts.
 */
const source = readFileSync("component/analytics/why/WhyAnalyticsFilters.tsx", "utf8");

test("supports period, product, owner, and outcome filters", () => {
  assert.match(source, /updateParameter\("period", /);
  assert.match(source, /updateParameter\("product", /);
  assert.match(source, /updateParameter\("owner", /);
  assert.match(source, /updateParameter\("outcome", /);
});

test("does not add a reason filter — the reasons are what this page analyzes", () => {
  assert.doesNotMatch(source, /updateParameter\("reason", /);
});

test("the outcome dropdown uses the centralized conversionOutcomeOptions, never a hardcoded list", () => {
  assert.match(
    source,
    /import\s*\{[^}]*conversionOutcomeOptions[^}]*\}\s*from\s*"@\/src\/lib\/prospect-conversion-options"/,
  );
  assert.match(source, /conversionOutcomeOptions\.map\(/);
});

test("the product dropdown uses the centralized product options, never a hardcoded list", () => {
  assert.match(source, /import\s*\{[^}]*productOptions[^}]*\}\s*from\s*"@\/src\/lib\/constants\/prospect-options"/);
  assert.match(source, /productOptions\.map\(/);
});

test("the owner dropdown is populated from the owners prop — not filtered to a formal role", () => {
  assert.match(source, /owners\.map\(/);
  assert.doesNotMatch(source, /role === "COMMERCIAL"/);
});

test("reset navigates to the bare why analytics route, clearing every filter at once", () => {
  assert.match(source, /router\.push\("\/admin\/analytics\/why"\)/);
});
