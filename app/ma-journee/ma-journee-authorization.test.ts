import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * /ma-journee transitively imports next-auth (via requireWorkdayEligibility),
 * so — like every other route-authorization test in this repo — it can't
 * be executed under plain node:test. Asserted against the source.
 */
const layoutSource = readFileSync("app/ma-journee/layout.tsx", "utf8");
const pageSource = readFileSync("app/ma-journee/page.tsx", "utf8");

test("the layout gates on requireWorkdayEligibility — MANAGER/COMMERCIAL/ASSISTANT, never a generic requireAuthenticatedUser or an ADMIN-inclusive role list", () => {
  assert.match(layoutSource, /requireWorkdayEligibility\(\)/);
  assert.doesNotMatch(layoutSource, /requireAuthenticatedUser\(\)/);
  assert.doesNotMatch(layoutSource, /requireAdmin\(\)/);
});

test("the layout redirects unauthenticated visitors to /login and denied roles (ADMIN) to /admin", () => {
  assert.match(layoutSource, /redirect\(error\.code === "UNAUTHENTICATED" \? "\/login" : "\/admin"\)/);
});

test("the layout picks CommercialShell for COMMERCIAL and AdminShell otherwise (MANAGER, ASSISTANT) — the same shell-selection pattern as every other shared self-service route", () => {
  assert.match(layoutSource, /user\.role === "COMMERCIAL"/);
  assert.match(layoutSource, /<CommercialShell/);
  assert.match(layoutSource, /<AdminShell>/);
});

test("the page also independently gates on requireWorkdayEligibility (defense in depth, matching every other route in this repo)", () => {
  assert.match(pageSource, /requireWorkdayEligibility\(\)/);
});

test("employee identity is always server-derived — the page never reads a userId/employee query parameter", () => {
  assert.doesNotMatch(pageSource, /searchParams/);
  assert.match(pageSource, /getMyDailyWork\(user\.id, workDate\)/);
});

test("the page resolves the business date via the canonical RELAIS helper, never browser-local time", () => {
  assert.match(pageSource, /getCurrentWorkDate\(\)/);
  assert.doesNotMatch(pageSource, /toLocaleDateString/);
  assert.doesNotMatch(pageSource, /new Date\(\)\.toLocaleDateString/);
});

test("ASSISTANT sees static guidance instead of the DailyTask list; MANAGER/COMMERCIAL see their tasks", () => {
  assert.match(pageSource, /user\.role === "ASSISTANT"/);
  assert.match(pageSource, /<AssistantDailyGuidance \/>/);
  assert.match(pageSource, /<DailyTaskList/);
});

test("no management controls (assignment/confirmation) appear on this employee-facing page — that belongs to 27G", () => {
  assert.doesNotMatch(pageSource, /assignDailyTaskAction/);
  assert.doesNotMatch(pageSource, /confirmWorkdayStartAction/);
  assert.doesNotMatch(pageSource, /cancelDailyTaskAction/);
  assert.doesNotMatch(layoutSource, /assignDailyTaskAction/);
});
