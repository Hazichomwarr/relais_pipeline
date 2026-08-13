import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * AnalyticsNav is a "use client" component built on next/navigation's
 * usePathname, which can't run outside a mounted Next.js app router under
 * plain node:test — same constraint as FunnelAnalyticsFilters.test.ts.
 */
const source = readFileSync("component/analytics/AnalyticsNav.tsx", "utf8");

test("links to exactly the two sibling analytics routes", () => {
  assert.match(source, /href:\s*"\/admin\/analytics\/funnel"/);
  assert.match(source, /href:\s*"\/admin\/analytics\/why"/);
});

test("labels the tabs Pipeline and Pourquoi ?", () => {
  assert.match(source, /label:\s*"Pipeline"/);
  assert.match(source, /label:\s*"Pourquoi \?"/);
});

test("active state is derived from usePathname, not a manually-passed prop", () => {
  assert.match(source, /usePathname\(\)/);
  assert.match(source, /pathname === tab\.href/);
});
