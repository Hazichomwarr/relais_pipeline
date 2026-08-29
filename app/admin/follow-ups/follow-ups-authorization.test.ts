import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Ticket 25R §10/§12: /admin/follow-ups had no authorization call of its
 * own before this ticket — it relied entirely on app/admin/layout.tsx's
 * then-ADMIN/MANAGER-only gate. Now that the shell gate admits ASSISTANT
 * (requireDashboardAccess), this route needs its own explicit, narrower
 * boundary. Asserted against the source (transitively imports next-auth,
 * same constraint as every other authorization page test in this repo).
 */
const source = readFileSync("app/admin/follow-ups/page.tsx", "utf8");

test("Ticket 25R §10/§12: the follow-up queue now has its own explicit requireFollowUpQueueManagementAccess() call, not just the inherited shell gate", () => {
  assert.match(source, /requireFollowUpQueueManagementAccess\(\)/);
});

test("an ACCESS_DENIED here redirects to /admin, not into a loop or the public homepage", () => {
  assert.match(source, /redirect\(error\.code === "UNAUTHENTICATED" \? "\/login" : "\/admin"\)/);
});
