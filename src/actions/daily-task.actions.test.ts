import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * "use server" — transitively pulls in Prisma via the service layer it
 * calls, so (like every other server action file in this repo) it can't
 * be executed under plain node:test. Asserted against the source.
 */
const source = readFileSync("src/actions/daily-task.actions.ts", "utf8");

test("Ticket 27E: assignDailyTaskAction and cancelDailyTaskAction validate input through zod before calling the service — never trust raw client values", () => {
  assert.match(source, /assignDailyTaskSchema\.safeParse\(values\)/);
  assert.match(source, /cancelDailyTaskSchema\.safeParse\(values\)/);
});

test("self actions (complete/uncomplete) call the service with authorization.user.id as the actor — never a client-supplied identity", () => {
  assert.match(source, /completeMyTask\(authorization\.user\.id, parsed\.data\.taskId\)/);
  assert.match(source, /uncompleteMyTask\(authorization\.user\.id, parsed\.data\.taskId\)/);
});

test("assignment/cancellation actions supply the acting user's id as the assignor/canceller — never a client-supplied assignedByUserId", () => {
  assert.match(source, /assignTask\(authorization\.user\.id, \{/);
  assert.match(source, /cancelTask\(authorization\.user\.id, \{/);
});

test("every action's coarse gate is a DailyTask capability wrapper, not a generic requireAuthenticatedUser", () => {
  assert.match(source, /requireTaskAssignmentAccess\(\)/);
  assert.match(source, /requireDailyTaskRecipientAccess\(\)/);
});

test("no action accepts assignedByUserId, assignedAt, status, completedAt, or an actor identity from client input", () => {
  assert.doesNotMatch(source, /assignedByUserId:\s*parsed\.data/);
  assert.doesNotMatch(source, /assignedAt:\s*parsed\.data/);
  assert.doesNotMatch(source, /status:\s*parsed\.data/);
  assert.doesNotMatch(source, /completedAt:\s*parsed\.data/);
});
