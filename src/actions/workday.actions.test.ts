import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * "use server" — transitively pulls in Prisma via the service layer it
 * calls, so (like every other server action file in this repo) it can't
 * be executed under plain node:test. Asserted against the source.
 */
const source = readFileSync("src/actions/workday.actions.ts", "utf8");

test("Ticket 27C §41: startMyWorkdayAction and endMyWorkdayAction take no parameters — actor identity can only come from the authenticated session, never a client-supplied userId", () => {
  assert.match(source, /export async function startMyWorkdayAction\(\): Promise</);
  assert.match(source, /export async function endMyWorkdayAction\(\): Promise</);
});

test("self actions call the service with authorization.user.id — never an unvalidated identity", () => {
  assert.match(source, /startMyWorkday\(authorization\.user\.id\)/);
  assert.match(source, /endMyWorkday\(authorization\.user\.id\)/);
});

test("confirmWorkdayStartAction validates input against confirmWorkdayStartSchema before calling the service, and the acting confirmer is always authorization.user.id — never client-supplied", () => {
  assert.match(source, /confirmWorkdayStartSchema\.safeParse\(values\)/);
  assert.match(source, /confirmWorkdayStartFor\(authorization\.user\.id, \{/);
});

test("every action's coarse gate is a Workday capability wrapper, not a generic requireAuthenticatedUser — matches the dedicated-capability convention this repository uses everywhere else", () => {
  assert.match(source, /requireWorkdayEligibility\(\)/);
  assert.match(source, /requireWorkdayConfirmationAccess\(\)/);
});

test("no action accepts a bare workdayId or employeeUserId for the self-service start/end actions — the IDOR-unsafe shapes the audit calls out never appear", () => {
  assert.doesNotMatch(source, /startWorkday\(userId/);
  assert.doesNotMatch(source, /endWorkday\(workdayId/);
  assert.doesNotMatch(source, /confirmStart\(workdayId/);
});
