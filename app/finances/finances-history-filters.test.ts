import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * /finances transitively imports next-auth, so — like
 * app/finances/finances-authorization.test.ts — it can't be executed
 * under plain node:test outside Next's runtime. These assertions run
 * against the source directly.
 */
const source = readFileSync("app/finances/page.tsx", "utf8");

test("history filters are parsed through the Ticket 17C.1 helper, never trusting raw searchParams", () => {
  assert.match(source, /parseLedgerHistoryFilter\(params\)/);
  assert.match(source, /listLedgerEntries\(filter\)/);
});

test("the KPI summary is fetched with no filter arguments — it must never narrow to the selected history filter", () => {
  assert.match(source, /getEffectiveFinancialLedgerSummary\(\)/);
});

test("the filtered-results empty state is distinct from the global empty state and offers a reset link", () => {
  assert.match(source, /Aucun mouvement ne correspond à ces filtres\./);
  assert.match(source, /Réinitialiser les filtres/);
  assert.match(source, /href="\/finances"/);
  // Global empty state (LedgerEmptyState) only renders when no filter is active.
  assert.match(source, /filter\.type \? \(/);
});

test("renders LedgerHistoryFilters wired to the parsed filter, not raw searchParams", () => {
  assert.match(source, /<LedgerHistoryFilters/);
  assert.match(source, /type=\{filter\.type\}/);
  assert.match(source, /category=\{filter\.category\}/);
  assert.match(source, /product=\{filter\.product\}/);
});

test("no ledger mutation actions were introduced on the read-only history page", () => {
  assert.doesNotMatch(source, /createLedgerEntryAction/);
  assert.doesNotMatch(source, /reverseLedgerEntryAction/);
});

test("create controls remain ADMIN-gated and unrelated to the history filters", () => {
  assert.match(source, /canCreate = user\.role === "ADMIN"/);
});

test("/finances/reports is untouched by this ticket (no history-filter imports leaked into reports)", () => {
  const reportsSource = readFileSync("app/finances/reports/page.tsx", "utf8");

  assert.doesNotMatch(reportsSource, /ledger-history-filters/);
  assert.doesNotMatch(reportsSource, /LedgerHistoryFilters/);
});
