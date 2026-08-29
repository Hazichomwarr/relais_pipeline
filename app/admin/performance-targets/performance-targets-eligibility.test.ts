import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Ticket 25P §34/§57: the target-creation employee dropdown must be
 * sourced from the COMMERCIAL+MANAGER eligibility list, never the
 * COMMERCIAL-only listAssignableUsers this page used before 25P. Asserted
 * against the source (this page is a server-only async component; no
 * Prisma in this environment), same convention as every other
 * *-authorization.test.ts / *-navigation.test.ts page-source check.
 */
const source = readFileSync("app/admin/performance-targets/page.tsx", "utf8");

test("Ticket 25P §34: the eligible-employee list is sourced from listCommercialResultsTargetEligibleUsers, not the Commercial-only listAssignableUsers", () => {
  assert.match(source, /listCommercialResultsTargetEligibleUsers\(/);
  assert.doesNotMatch(source, /listAssignableUsers/);
});

test("Ticket 25R §10/§12/§58: the route now has its own explicit requireCommercialPerformanceTargetManagementAccess() call, not just the inherited shell gate — this reuses the existing target-management capability, not a new policy", () => {
  assert.match(source, /requireCommercialPerformanceTargetManagementAccess\(\)/);
});

test("an ACCESS_DENIED here redirects to /admin, not into a loop or the public homepage", () => {
  assert.match(source, /redirect\(error\.code === "UNAUTHENTICATED" \? "\/login" : "\/admin"\)/);
});
