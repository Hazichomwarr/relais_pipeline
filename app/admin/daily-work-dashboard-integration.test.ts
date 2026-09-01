import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * app/admin/page.tsx transitively imports next-auth, so — like every
 * other Server Component page-content test in this repo — it can't be
 * executed under plain node:test. Asserted against the source.
 */
const source = readFileSync("app/admin/page.tsx", "utf8");

test("Ticket 27H §14: MANAGER gets a personal Ma journée entry pointing to /ma-journee, gated behind actor.role === \"MANAGER\"", () => {
  const gateMatch = source.match(
    /actor\.role === "MANAGER" && \(\s*\n\s*<DailyWorkEntryCard[\s\S]*?title="Ma journée"[\s\S]*?\/>/,
  );
  assert.ok(gateMatch, "expected a MANAGER-gated Ma journée DailyWorkEntryCard");
  assert.match(gateMatch![0], /href="\/ma-journee"/);
});

test("Ticket 27H §15: the ADMIN/MANAGER dashboard always exposes Journées des agents, unconditionally within that branch, pointing to /admin/journees-agents", () => {
  const entryMatch = source.match(
    /<DailyWorkEntryCard[\s\S]*?title="Journées des agents"[\s\S]*?\/>/,
  );
  assert.ok(entryMatch, "expected a Journées des agents DailyWorkEntryCard");
  assert.match(entryMatch![0], /href="\/admin\/journees-agents"/);
});

test("Ticket 27H §15: ADMIN never receives a personal Ma journée entry, even disabled — ADMIN has no personal Workday (27A §4)", () => {
  // Exactly one "Ma journée" DailyWorkEntryCard exists in this file at
  // all (the MANAGER-gated one confirmed above) — never a second,
  // unconditional or ADMIN-gated, occurrence.
  const occurrences = source.match(/title="Ma journée"/g) ?? [];
  assert.equal(occurrences.length, 1);

  // And there is no ADMIN-role gate anywhere near a Ma journée title.
  const adminGated = source.match(
    /actor\.role === "ADMIN"[\s\S]{0,120}title="Ma journée"/,
  );
  assert.equal(adminGated, null);
});

test("Ticket 27H §16: ASSISTANT's shortcut grid includes Ma journée pointing to /ma-journee, and does not include a separate Tâches du jour shortcut (Assistant has no DailyTask workflow)", () => {
  const shortcutsBlock = source.match(
    /const ASSISTANT_SHORTCUTS: AssistantShortcut\[\] = \[[\s\S]*?\n\];/,
  );
  assert.ok(shortcutsBlock, "expected the ASSISTANT_SHORTCUTS array");

  assert.match(shortcutsBlock![0], /label: "Ma journée"/);
  assert.match(shortcutsBlock![0], /href: "\/ma-journee"/);
  assert.doesNotMatch(shortcutsBlock![0], /Tâches du jour/);
});

test("Ticket 27H §18: no new dashboard KPI (attendance/lateness/completion-rate) was introduced alongside the Daily Work entry cards", () => {
  for (const forbidden of [
    "Agents présents",
    "Retards",
    "Taux de présence",
    "Productivité",
  ]) {
    assert.doesNotMatch(source, new RegExp(forbidden));
  }
});
