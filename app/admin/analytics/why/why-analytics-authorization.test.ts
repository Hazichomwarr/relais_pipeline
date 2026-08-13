import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * /admin/analytics/why transitively imports next-auth (via
 * requireSalesAnalyticsAccess), so it can't be executed under plain
 * node:test outside Next's runtime — asserted against the source directly,
 * same convention as funnel-analytics-authorization.test.ts. This page is
 * also nested under app/admin/layout.tsx's own ADMIN/MANAGER gate, but
 * re-authorizes itself independently.
 */
const source = readFileSync("app/admin/analytics/why/page.tsx", "utf8");

test("gates access via requireSalesAnalyticsAccess (ADMIN/MANAGER), not a broader or narrower check", () => {
  assert.match(source, /requireSalesAnalyticsAccess\(\)/);
  assert.doesNotMatch(source, /requireAuthenticatedUser\(/);
  assert.doesNotMatch(source, /requireProspectActionQueueAccess\(/);
  assert.doesNotMatch(source, /requireAdmin\(\)/);
});

test("a denied visitor is redirected to /admin (already inside the admin shell), an unauthenticated one to /login", () => {
  assert.match(
    source,
    /redirect\(error\.code === "UNAUTHENTICATED" \? "\/login" : "\/admin"\)/,
  );
});

test("authorization runs before any analytics data is fetched", () => {
  const authorizeIndex = source.indexOf("requireSalesAnalyticsAccess()");
  const fetchIndex = source.indexOf("getSalesWhyAnalytics(");

  assert.ok(authorizeIndex >= 0, "requireSalesAnalyticsAccess() call not found");
  assert.ok(fetchIndex >= 0, "getSalesWhyAnalytics(...) call not found");
  assert.ok(authorizeIndex < fetchIndex, "authorization must happen before the fetch");
});

test("SALES_ANALYTICS_ROLES is ADMIN/MANAGER only — reuses 20F's boundary, no new role constant", () => {
  const authSource = readFileSync("src/services/authorization.service-core.ts", "utf8");
  assert.match(
    authSource,
    /export const SALES_ANALYTICS_ROLES: UserRole\[\] = \["ADMIN", "MANAGER"\];/,
  );
});

test("renders AnalyticsNav — reachable from and back to /admin/analytics/funnel", () => {
  assert.match(source, /<AnalyticsNav \/>/);
});
