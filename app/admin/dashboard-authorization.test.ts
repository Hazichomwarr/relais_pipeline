import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * app/admin/page.tsx transitively imports next-auth (via
 * requireDashboardAccess) — can't run under plain node:test. Asserted
 * against the source, same convention as every other authorization page
 * test in this repo.
 *
 * Ticket 25R §5-13: ASSISTANT now passes this route's authorization but
 * must receive deliberately different, minimal content — no prospect
 * data, no KPI, no company-wide query of any kind. These tests lock in
 * both halves: the access grant and the content boundary.
 */
const source = readFileSync("app/admin/page.tsx", "utf8");

test("Ticket 25R §5-8: the dashboard route has its own explicit requireDashboardAccess() call, not just the inherited layout gate", () => {
  assert.match(source, /requireDashboardAccess\(\)/);
});

test("an ACCESS_DENIED here redirects to the public homepage, not back into /admin", () => {
  assert.match(source, /redirect\(error\.code === "UNAUTHENTICATED" \? "\/login" : "\/"\)/);
});

test("Ticket 25R §9-13: ASSISTANT is branched to a distinct return before any prospect data is fetched — getProspects is never called on the ASSISTANT path", () => {
  const assistantBranchIndex = source.indexOf('actor.role === "ASSISTANT"');
  const getProspectsIndex = source.indexOf("getProspects(");

  assert.ok(assistantBranchIndex >= 0, "expected an explicit ASSISTANT branch");
  assert.ok(getProspectsIndex >= 0, "expected getProspects to still be called for ADMIN/MANAGER");
  assert.ok(
    assistantBranchIndex < getProspectsIndex,
    "the ASSISTANT branch must return before the prospect query, not merely hide the data client-side",
  );

  // Structural guarantee: the ASSISTANT branch's own return block contains
  // no reference to prospects, KPIs, or business stats at all.
  const assistantReturnBlock = source.slice(
    assistantBranchIndex,
    source.indexOf("const params = await searchParams;"),
  );
  assert.doesNotMatch(assistantReturnBlock, /getProspects|KpiCards|BusinessStats|DashboardTable|listDashboardUserOptions/);
});

test("Ticket 25R §12/§13: every ASSISTANT shortcut links only to a route this role is independently authorized for — Finances, Mes notes, Mes rapports", () => {
  const shortcutsBlock = source.slice(
    source.indexOf("const ASSISTANT_SHORTCUTS"),
    source.indexOf("function AssistantDashboardOverview"),
  );

  assert.match(shortcutsBlock, /href: "\/finances"/);
  assert.match(shortcutsBlock, /href: "\/notes"/);
  assert.match(shortcutsBlock, /href: "\/reports"/);

  // No forbidden surface is ever offered as a shortcut.
  assert.doesNotMatch(shortcutsBlock, /"\/admin\/users"|"\/admin\/performance"|"\/admin\/my-prospects"|"\/admin\/follow-ups"/);
});

test("Ticket 25R §66: ASSISTANT's dashboard content never labels the viewer as Administrateur", () => {
  const overviewIndex = source.indexOf("function AssistantDashboardOverview");
  const overviewBlock = source.slice(overviewIndex);
  assert.doesNotMatch(overviewBlock, /Administrateur/);
});
