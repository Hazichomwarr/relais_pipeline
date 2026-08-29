import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * app/admin/layout.tsx transitively imports next-auth (via requireRole) —
 * can't run under plain node:test. Asserted against the source.
 */
const source = readFileSync("app/admin/layout.tsx", "utf8");

test("Ticket 25M §25: the /admin shell gate remains ADMIN/MANAGER only — ASSISTANT is NOT added here (no permission expansion in 25M)", () => {
  assert.match(source, /requireRole\("ADMIN", "MANAGER"\)/);
  assert.doesNotMatch(source, /"ASSISTANT"/);
});

test("Ticket 25M §19: an ACCESS_DENIED here redirects to the public homepage, not back into /admin — this is exactly why ASSISTANT must never be routed to /admin in the first place (see src/lib/dashboard-routing.ts)", () => {
  assert.match(source, /redirect\(error\.code === "UNAUTHENTICATED" \? "\/login" : "\/"\)/);
});
