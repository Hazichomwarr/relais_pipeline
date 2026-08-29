import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * app/admin/layout.tsx transitively imports next-auth (via
 * requireDashboardAccess) — can't run under plain node:test. Asserted
 * against the source.
 */
const source = readFileSync("app/admin/layout.tsx", "utf8");

test("Ticket 25R §5-7: the /admin shell gate now uses requireDashboardAccess() — a named capability, not an inline requireRole call — and ASSISTANT is explicitly documented, not silently added", () => {
  assert.match(source, /requireDashboardAccess\(\)/);
  assert.doesNotMatch(source, /requireRole\(/);
  assert.match(source, /ASSISTANT/);
});

test("an ACCESS_DENIED here still redirects to the public homepage, not back into /admin", () => {
  assert.match(source, /redirect\(error\.code === "UNAUTHENTICATED" \? "\/login" : "\/"\)/);
});

test("requireAdmin() itself is never imported or called here — the shell gate must never be confused with true ADMIN-only authority", () => {
  assert.doesNotMatch(source, /requireAdmin/);
});
