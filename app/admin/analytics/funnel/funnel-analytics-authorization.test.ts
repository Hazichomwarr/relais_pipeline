import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * /admin/analytics/funnel transitively imports next-auth (via
 * requireSalesAnalyticsAccess), so — like
 * app/admin/my-prospects/my-prospects-authorization.test.ts — it can't be
 * executed under plain node:test outside Next's runtime. Asserted
 * against the source directly instead. This page is also nested under
 * app/admin/layout.tsx's own ADMIN/MANAGER gate, but re-authorizes itself
 * independently (same self-contained convention as /updates and
 * /actions) rather than relying solely on the outer layout.
 */
const source = readFileSync("app/admin/analytics/funnel/page.tsx", "utf8");

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
  const fetchIndex = source.indexOf("getSalesFunnelAnalytics(");

  assert.ok(authorizeIndex >= 0, "requireSalesAnalyticsAccess() call not found");
  assert.ok(fetchIndex >= 0, "getSalesFunnelAnalytics(...) call not found");
  assert.ok(authorizeIndex < fetchIndex, "authorization must happen before the fetch");
});

test("SALES_ANALYTICS_ROLES is ADMIN/MANAGER only — COMMERCIAL is deliberately excluded from company-wide analytics", () => {
  const authSource = readFileSync("src/services/authorization.service-core.ts", "utf8");
  assert.match(
    authSource,
    /export const SALES_ANALYTICS_ROLES: UserRole\[\] = \["ADMIN", "MANAGER"\];/,
  );
});
