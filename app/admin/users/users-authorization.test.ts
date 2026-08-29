import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Ticket 25R §21/§22/§61: user administration must remain ADMIN-only
 * even though ASSISTANT now passes the /admin shell gate — the shell
 * gate's own widening must never be mistaken for a reason to touch this
 * route. Asserted against the source (transitively imports next-auth).
 */
const source = readFileSync("app/admin/users/page.tsx", "utf8");

test("Ticket 25R §21/§22: /admin/users still calls requireAdmin() directly — the new dashboard-shell capability was never substituted in here", () => {
  assert.match(source, /requireAdmin\(\)/);
  assert.doesNotMatch(source, /requireDashboardAccess/);
});
