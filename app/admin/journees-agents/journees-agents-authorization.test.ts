import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * /admin/journees-agents transitively imports next-auth (via
 * requireDailyWorkManagementAccess), so — like every other route-
 * authorization test in this repo — it can't be executed under plain
 * node:test. Asserted against the source.
 */
const layoutSource = readFileSync("app/admin/journees-agents/layout.tsx", "utf8");
const pageSource = readFileSync("app/admin/journees-agents/page.tsx", "utf8");

test("the layout gates on requireDailyWorkManagementAccess — ADMIN/MANAGER only, never bare /admin layout inheritance", () => {
  assert.match(layoutSource, /requireDailyWorkManagementAccess\(\)/);
  assert.doesNotMatch(layoutSource, /requireAuthenticatedUser\(\)/);
  assert.doesNotMatch(layoutSource, /requireDashboardAccess\(\)/);
});

test("the layout redirects unauthenticated visitors to /login and denied roles (COMMERCIAL, ASSISTANT) to /admin", () => {
  assert.match(layoutSource, /redirect\(error\.code === "UNAUTHENTICATED" \? "\/login" : "\/admin"\)/);
});

test("the page also independently gates on requireDailyWorkManagementAccess (defense in depth)", () => {
  assert.match(pageSource, /requireDailyWorkManagementAccess\(\)/);
});

test("the page resolves the business date via the canonical RELAIS helper, never browser-local time, and is a today-only workspace (no date param read)", () => {
  assert.match(pageSource, /getCurrentWorkDate\(\)/);
  assert.doesNotMatch(pageSource, /toLocaleDateString/);
  assert.doesNotMatch(pageSource, /params\.(date|from|to)\b/);
});

test("agent selection is presentation-only URL state — the composition call never receives the raw searchParams value as authority", () => {
  assert.match(pageSource, /getDailyWorkManagementOverview\(\s*\{ id: actor\.id, role: actor\.role \}/);
  assert.doesNotMatch(pageSource, /getDailyWorkManagementOverview\([^)]*params\.agent/);
});

test("no employee-impersonation action (start/end/complete/uncomplete another person's Workday or task) is referenced anywhere on this route", () => {
  for (const source of [layoutSource, pageSource]) {
    assert.doesNotMatch(source, /startMyWorkdayAction/);
    assert.doesNotMatch(source, /endMyWorkdayAction/);
    assert.doesNotMatch(source, /completeMyDailyTaskAction/);
    assert.doesNotMatch(source, /uncompleteMyDailyTaskAction/);
  }
});
