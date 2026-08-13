import assert from "node:assert/strict";
import test from "node:test";
import type { ProspectConversionOutcome, ProspectConversionReason } from "@prisma/client";

import { resolveSalesFunnelPeriod } from "@/src/lib/sales-funnel-period";
import {
  buildSalesWhyAnalytics,
  type SalesWhyOutcomeRow,
} from "./sales-why-analytics.service-core";

const PERIOD = resolveSalesFunnelPeriod("month", new Date("2026-08-13T10:00:00.000Z"));

function row(overrides: Partial<SalesWhyOutcomeRow> = {}): SalesWhyOutcomeRow {
  return {
    conversionOutcome: "ADVANCED",
    conversionReason: "DEMO_CONVINCED",
    conversionReasonNote: null,
    product: "KARMDA",
    assignedUserId: "owner-1",
    assignedUser: { firstName: "Julbert", lastName: "Serme" },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Event semantics — no dedup by prospect, this core doesn't even see prospectId
// ---------------------------------------------------------------------------

test("two structured follow-up rows both count as separate events", () => {
  const rows = [
    row({ conversionOutcome: "STALLED", conversionReason: "NEEDS_MORE_TIME" }),
    row({ conversionOutcome: "WON", conversionReason: "PROMOTIONAL_OFFER" }),
  ];
  const analytics = buildSalesWhyAnalytics(PERIOD, rows);
  assert.equal(analytics.summary.structuredFollowUps, 2);
});

// ---------------------------------------------------------------------------
// Reconciliation invariants — the ticket's core contract
// ---------------------------------------------------------------------------

test("summary: advanced + stalled + won + lost === structuredFollowUps", () => {
  const rows = [
    row({ conversionOutcome: "ADVANCED", conversionReason: "DEMO_CONVINCED" }),
    row({ conversionOutcome: "ADVANCED", conversionReason: "PROMOTIONAL_OFFER" }),
    row({ conversionOutcome: "STALLED", conversionReason: "NO_BUDGET" }),
    row({ conversionOutcome: "WON", conversionReason: "PROMOTIONAL_OFFER" }),
    row({ conversionOutcome: "LOST", conversionReason: "COMPETITOR" }),
  ];
  const analytics = buildSalesWhyAnalytics(PERIOD, rows);
  const { advanced, stalled, won, lost, structuredFollowUps } = analytics.summary;
  assert.equal(advanced + stalled + won + lost, structuredFollowUps);
  assert.equal(structuredFollowUps, 5);
});

test("reasons: sum(reason.count) === structuredFollowUps", () => {
  const rows = [
    row({ conversionOutcome: "ADVANCED", conversionReason: "DEMO_CONVINCED" }),
    row({ conversionOutcome: "ADVANCED", conversionReason: "PROMOTIONAL_OFFER" }),
    row({ conversionOutcome: "WON", conversionReason: "PROMOTIONAL_OFFER" }),
    row({ conversionOutcome: "STALLED", conversionReason: "NO_BUDGET" }),
  ];
  const analytics = buildSalesWhyAnalytics(PERIOD, rows);
  const sum = analytics.reasons.reduce((total, entry) => total + entry.count, 0);
  assert.equal(sum, analytics.summary.structuredFollowUps);
});

test("matrix: for every reason, advanced+stalled+won+lost === reason.total, and the grand total === structuredFollowUps", () => {
  // OTHER is the universal escape hatch (Ticket 20D) — the only reason valid
  // for all 4 outcomes, so it's the one usable to test a single reason
  // spanning multiple outcomes without producing an invalid combination.
  const rows = [
    row({ conversionOutcome: "ADVANCED", conversionReason: "OTHER", conversionReasonNote: "n" }),
    row({ conversionOutcome: "WON", conversionReason: "OTHER", conversionReasonNote: "n" }),
    row({ conversionOutcome: "STALLED", conversionReason: "OTHER", conversionReasonNote: "n" }),
    row({ conversionOutcome: "STALLED", conversionReason: "NO_BUDGET" }),
  ];
  const analytics = buildSalesWhyAnalytics(PERIOD, rows);

  for (const matrixRow of analytics.matrix) {
    assert.equal(
      matrixRow.advanced + matrixRow.stalled + matrixRow.won + matrixRow.lost,
      matrixRow.total,
    );
  }

  const grandTotal = analytics.matrix.reduce(
    (total, matrixRow) => total + matrixRow.total,
    0,
  );
  assert.equal(grandTotal, analytics.summary.structuredFollowUps);

  const other = analytics.matrix.find((m) => m.reason === "OTHER");
  assert.deepEqual(other, {
    reason: "OTHER",
    total: 3,
    advanced: 1,
    stalled: 1,
    won: 1,
    lost: 0,
  });
});

// ---------------------------------------------------------------------------
// Percentage denominators — never cross-contaminated
// ---------------------------------------------------------------------------

test("overall reason percentage is relative to structuredFollowUps, not to the outcome subset", () => {
  const rows = [
    row({ conversionOutcome: "ADVANCED", conversionReason: "PROMOTIONAL_OFFER" }),
    row({ conversionOutcome: "STALLED", conversionReason: "NO_BUDGET" }),
    row({ conversionOutcome: "STALLED", conversionReason: "NO_BUDGET" }),
    row({ conversionOutcome: "STALLED", conversionReason: "NO_BUDGET" }),
  ];
  const analytics = buildSalesWhyAnalytics(PERIOD, rows);
  const promo = analytics.reasons.find((entry) => entry.reason === "PROMOTIONAL_OFFER");
  assert.equal(promo?.percentage, 25); // 1/4, not 1/1
});

test("per-outcome reason percentage is relative to that outcome's total", () => {
  const rows = [
    row({ conversionOutcome: "STALLED", conversionReason: "NO_BUDGET" }),
    row({ conversionOutcome: "STALLED", conversionReason: "NO_RESPONSE" }),
    row({ conversionOutcome: "STALLED", conversionReason: "NO_RESPONSE" }),
    row({ conversionOutcome: "ADVANCED", conversionReason: "DEMO_CONVINCED" }),
  ];
  const analytics = buildSalesWhyAnalytics(PERIOD, rows);
  const stalled = analytics.byOutcome.find((entry) => entry.outcome === "STALLED");
  const noResponse = stalled?.reasons.find((entry) => entry.reason === "NO_RESPONSE");
  assert.equal(stalled?.total, 3);
  assert.equal(noResponse?.percentage, (2 / 3) * 100); // out of 3 STALLED rows, not 4 total
});

test("zero denominator produces 0, never NaN/Infinity", () => {
  const analytics = buildSalesWhyAnalytics(PERIOD, []);
  assert.equal(analytics.summary.structuredFollowUps, 0);
  assert.equal(analytics.reasons.length, 0);
  for (const entry of analytics.byOutcome) {
    assert.equal(entry.total, 0);
    assert.equal(entry.reasons.length, 0);
  }
});

// ---------------------------------------------------------------------------
// All 4 outcomes are always enumerated, sparse or not
// ---------------------------------------------------------------------------

test("byOutcome always has exactly 4 entries (ADVANCED/STALLED/WON/LOST), even with zero WON/LOST rows", () => {
  const rows = [row({ conversionOutcome: "ADVANCED", conversionReason: "DEMO_CONVINCED" })];
  const analytics = buildSalesWhyAnalytics(PERIOD, rows);
  const outcomes = analytics.byOutcome.map((entry) => entry.outcome).sort();
  assert.deepEqual(outcomes, ["ADVANCED", "LOST", "STALLED", "WON"].sort());

  const lost = analytics.byOutcome.find((entry) => entry.outcome === "LOST");
  assert.equal(lost?.total, 0);
  assert.deepEqual(lost?.reasons, []);
});

// ---------------------------------------------------------------------------
// Product / owner breakdowns — only entries with data, no leaderboard
// ---------------------------------------------------------------------------

test("byProduct only includes products with structured data in scope", () => {
  const rows = [row({ product: "KARMDA" }), row({ product: "NIA" })];
  const analytics = buildSalesWhyAnalytics(PERIOD, rows);
  const products = analytics.byProduct.map((entry) => entry.product).sort();
  assert.deepEqual(products, ["KARMDA", "NIA"]);
});

test("byOwner is sorted alphabetically, never by volume", () => {
  const rows = [
    ...Array.from({ length: 5 }, () =>
      row({ assignedUserId: "owner-z", assignedUser: { firstName: "Zenabo", lastName: "Z" } }),
    ),
    row({ assignedUserId: "owner-a", assignedUser: { firstName: "Awa", lastName: "A" } }),
  ];
  const analytics = buildSalesWhyAnalytics(PERIOD, rows);
  assert.deepEqual(
    analytics.byOwner.map((entry) => entry.ownerName),
    ["Awa A", "Zenabo Z"],
  );
});

test("owner grouping uses assignedUserId regardless of formal role, including an unassigned bucket", () => {
  const rows = [
    row({ assignedUserId: "owner-1", assignedUser: { firstName: "A", lastName: "B" } }),
    row({ assignedUserId: null, assignedUser: null }),
  ];
  const analytics = buildSalesWhyAnalytics(PERIOD, rows);
  const unassigned = analytics.byOwner.find((entry) => entry.ownerUserId === null);
  assert.ok(unassigned);
  assert.equal(unassigned?.ownerName, "Non attribué");
});

// ---------------------------------------------------------------------------
// Reason compatibility — reuses the centralized 20D authority, no 2nd table
// ---------------------------------------------------------------------------

test("a corrupted outcome/reason pair (fails isConversionReasonAllowedForOutcome) is excluded, not reclassified", () => {
  // NO_BUDGET is a STALLED/LOST reason, never valid for ADVANCED.
  const rows = [
    row({ conversionOutcome: "ADVANCED", conversionReason: "NO_BUDGET" as ProspectConversionReason }),
    row({ conversionOutcome: "ADVANCED", conversionReason: "DEMO_CONVINCED" }),
  ];
  const analytics = buildSalesWhyAnalytics(PERIOD, rows);
  assert.equal(analytics.summary.structuredFollowUps, 1);
  assert.equal(
    analytics.reasons.find((entry) => entry.reason === "NO_BUDGET"),
    undefined,
  );
});

// ---------------------------------------------------------------------------
// OTHER explanations — verbatim from conversionReasonNote only
// ---------------------------------------------------------------------------

test("OTHER count reconciles normally and explanations come only from conversionReasonNote", () => {
  const rows = [
    row({
      conversionOutcome: "STALLED",
      conversionReason: "OTHER",
      conversionReasonNote: "Attend la rentrée scolaire prochaine",
    }),
    row({ conversionOutcome: "ADVANCED", conversionReason: "DEMO_CONVINCED" }),
  ];
  const analytics = buildSalesWhyAnalytics(PERIOD, rows);
  const other = analytics.reasons.find((entry) => entry.reason === "OTHER");
  assert.equal(other?.count, 1);
  assert.deepEqual(analytics.otherExplanations, ["Attend la rentrée scolaire prochaine"]);
});

test("a blank conversionReasonNote never surfaces as an empty explanation", () => {
  const rows = [
    row({ conversionOutcome: "STALLED", conversionReason: "OTHER", conversionReasonNote: "   " }),
  ];
  const analytics = buildSalesWhyAnalytics(PERIOD, rows);
  assert.deepEqual(analytics.otherExplanations, []);
});

// ---------------------------------------------------------------------------
// Sort determinism
// ---------------------------------------------------------------------------

test("reasons are sorted by count descending, then reason value ascending as a tie-break", () => {
  const rows = [
    row({ conversionOutcome: "STALLED", conversionReason: "NO_RESPONSE" }),
    row({ conversionOutcome: "STALLED", conversionReason: "NO_BUDGET" }),
    row({ conversionOutcome: "ADVANCED", conversionReason: "PROMOTIONAL_OFFER" }),
    row({ conversionOutcome: "ADVANCED", conversionReason: "PROMOTIONAL_OFFER" }),
  ];
  const analytics = buildSalesWhyAnalytics(PERIOD, rows);
  assert.deepEqual(
    analytics.reasons.map((entry) => entry.reason),
    ["PROMOTIONAL_OFFER", "NO_BUDGET", "NO_RESPONSE"],
  );
});

test("outcome round-trip: aggregation is correct independently for all four outcomes", () => {
  const outcomeReasons: Record<ProspectConversionOutcome, ProspectConversionReason> = {
    ADVANCED: "DEMO_CONVINCED",
    STALLED: "NO_BUDGET",
    WON: "PROMOTIONAL_OFFER",
    LOST: "COMPETITOR",
  };
  for (const [outcome, reason] of Object.entries(outcomeReasons) as Array<
    [ProspectConversionOutcome, ProspectConversionReason]
  >) {
    const analytics = buildSalesWhyAnalytics(PERIOD, [row({ conversionOutcome: outcome, conversionReason: reason })]);
    const entry = analytics.byOutcome.find((e) => e.outcome === outcome);
    assert.equal(entry?.total, 1);
    assert.equal(entry?.reasons[0]?.reason, reason);
  }
});
