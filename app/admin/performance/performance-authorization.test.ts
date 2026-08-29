import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * The performance dashboard page transitively imports next-auth (via
 * requireRole), so — like app/products/... — it can't be executed under
 * plain node:test outside Next's runtime. Asserted against the source.
 */
const source = readFileSync("app/admin/performance/page.tsx", "utf8");

test("the dashboard authorizes via requirePerformanceDashboardAccess before fetching any employee/period data", () => {
  const authorizeIndex = source.indexOf("requirePerformanceDashboardAccess(");
  const fetchIndex = source.indexOf("listUsers(");

  assert.ok(authorizeIndex >= 0, "requirePerformanceDashboardAccess() call not found");
  assert.ok(fetchIndex >= 0, "listUsers() call not found");
  assert.ok(authorizeIndex < fetchIndex);
});

test("redirects unauthenticated visitors to /login and unauthorized roles to /admin, same pattern as every other admin route", () => {
  assert.match(
    source,
    /redirect\(error\.code === "UNAUTHENTICATED" \? "\/login" : "\/admin"\)/,
  );
});

test("Ticket 25K §36: the actor's resolved role, not client input, is passed into getEmployeePerformanceSummary — IDOR protection against a spoofed scope", () => {
  assert.match(source, /getEmployeePerformanceSummary\(actor,/);
});

test("Ticket 25K §37/§41: the dashboard is read-only — no Server Action, no create/submit/delete call anywhere on the page", () => {
  assert.doesNotMatch(source, /Action\(/);
  assert.doesNotMatch(source, /"use client"/);
});

test("Ticket 25K §19: employees are listed via listUsers() (no active filter) so inactive/historical employees remain selectable, never hidden", () => {
  assert.match(source, /listUsers\(\)/);
  assert.doesNotMatch(source, /active:\s*true.*listUsers/);
});

test("Ticket 25K §60: no manual score input exists anywhere on the page", () => {
  assert.doesNotMatch(source, /<input[^>]*name="(score|overall)"/);
});

test("Ticket 25K §65: defaults to the latest closed calendar month, not the current open one", () => {
  assert.match(source, /latestClosedMonth\(\)/);
});

test("Ticket 25K §63: the selector is a plain GET form, matching this repo's existing filter convention — no client-side state", () => {
  assert.match(source, /method="get"/);
});
