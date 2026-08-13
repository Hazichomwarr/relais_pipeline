import assert from "node:assert/strict";
import test from "node:test";
import type {
  InterestLevel,
  ProspectConversionOutcome,
  RelaisProduct,
  UserRole,
} from "@prisma/client";

import { resolveSalesFunnelPeriod } from "@/src/lib/sales-funnel-period";
import {
  buildSalesFunnelAnalytics,
  type SalesFunnelOutcomeRow,
  type SalesFunnelProspectRow,
} from "./sales-funnel-analytics.service-core";

const PERIOD = resolveSalesFunnelPeriod("month", new Date("2026-08-13T10:00:00.000Z"));

let nextId = 1;

function prospectRow(overrides: Partial<SalesFunnelProspectRow> = {}): SalesFunnelProspectRow {
  nextId += 1;
  return {
    id: `prospect-${nextId}`,
    status: "NEW",
    interest: "MAYBE",
    product: "KARMDA",
    assignedUserId: "owner-1",
    assignedUser: { firstName: "Julbert", lastName: "Serme" },
    ...overrides,
  };
}

function outcomeRow(conversionOutcome: ProspectConversionOutcome): SalesFunnelOutcomeRow {
  return { conversionOutcome };
}

// ---------------------------------------------------------------------------
// Pipeline distribution — the ticket's exact worked example
// ---------------------------------------------------------------------------

test("current pipeline includes exact counts for every one of the 7 statuses, none dropped", () => {
  const prospects = [
    ...Array.from({ length: 5 }, () => prospectRow({ status: "NEW" })),
    ...Array.from({ length: 3 }, () => prospectRow({ status: "CONTACTED" })),
    ...Array.from({ length: 2 }, () => prospectRow({ status: "QUALIFIED" })),
    prospectRow({ status: "PROPOSAL_SENT" }),
    prospectRow({ status: "WON" }),
    prospectRow({ status: "LOST" }),
    ...Array.from({ length: 2 }, () => prospectRow({ status: "TO_FOLLOW_UP" })),
  ];

  const analytics = buildSalesFunnelAnalytics(PERIOD, prospects, []);
  const counts = Object.fromEntries(
    analytics.currentPipeline.map((item) => [item.status, item.count]),
  );

  assert.deepEqual(counts, {
    NEW: 5,
    TO_FOLLOW_UP: 2,
    CONTACTED: 3,
    QUALIFIED: 2,
    PROPOSAL_SENT: 1,
    WON: 1,
    LOST: 1,
  });
  assert.equal(analytics.currentPipeline.length, 7);
});

// ---------------------------------------------------------------------------
// Reconciliation invariants
// ---------------------------------------------------------------------------

test("sum(currentPipeline.count) === summary.totalProspects", () => {
  const prospects = [
    prospectRow({ status: "NEW" }),
    prospectRow({ status: "QUALIFIED" }),
    prospectRow({ status: "WON" }),
    prospectRow({ status: "LOST" }),
  ];
  const analytics = buildSalesFunnelAnalytics(PERIOD, prospects, []);
  const sum = analytics.currentPipeline.reduce((total, item) => total + item.count, 0);
  assert.equal(sum, analytics.summary.totalProspects);
});

test("sum(byProduct.total) === summary.totalProspects, for a mix of every product", () => {
  const prospects = [
    prospectRow({ product: "KARMDA" }),
    prospectRow({ product: "KARMDA" }),
    prospectRow({ product: "DIGITAL_SERVICES" }),
    prospectRow({ product: "LOKARI" }),
    prospectRow({ product: "NIA" }),
  ];
  const analytics = buildSalesFunnelAnalytics(PERIOD, prospects, []);
  const sum = analytics.byProduct.reduce((total, entry) => total + entry.total, 0);
  assert.equal(sum, analytics.summary.totalProspects);
  assert.equal(sum, 5);
});

test("sum(byOwner.total) === summary.totalProspects, including an unassigned bucket", () => {
  const prospects = [
    prospectRow({ assignedUserId: "owner-1", assignedUser: { firstName: "A", lastName: "B" } }),
    prospectRow({ assignedUserId: "owner-2", assignedUser: { firstName: "C", lastName: "D" } }),
    prospectRow({ assignedUserId: null, assignedUser: null }),
  ];
  const analytics = buildSalesFunnelAnalytics(PERIOD, prospects, []);
  const sum = analytics.byOwner.reduce((total, entry) => total + entry.total, 0);
  assert.equal(sum, analytics.summary.totalProspects);
  assert.equal(sum, 3);

  const unassigned = analytics.byOwner.find((entry) => entry.ownerUserId === null);
  assert.ok(unassigned, "expected a Non attribué bucket");
  assert.equal(unassigned?.ownerName, "Non attribué");
  assert.equal(unassigned?.total, 1);
});

test("every current RelaisProduct appears in byProduct, even at zero — a future product needs no funnel-domain change", () => {
  const analytics = buildSalesFunnelAnalytics(PERIOD, [prospectRow({ product: "KARMDA" })], []);
  const products = analytics.byProduct.map((entry) => entry.product).sort();
  assert.deepEqual(products, ["DIGITAL_SERVICES", "KARMDA", "LOKARI", "NIA"].sort());

  const lokari = analytics.byProduct.find((entry) => entry.product === "LOKARI");
  assert.equal(lokari?.total, 0);
});

// ---------------------------------------------------------------------------
// Product / owner neutrality
// ---------------------------------------------------------------------------

test("aggregation is correct independently for all four products", () => {
  const products: RelaisProduct[] = ["KARMDA", "DIGITAL_SERVICES", "LOKARI", "NIA"];
  for (const product of products) {
    const analytics = buildSalesFunnelAnalytics(
      PERIOD,
      [prospectRow({ product, status: "WON" })],
      [],
    );
    const entry = analytics.byProduct.find((e) => e.product === product);
    assert.equal(entry?.total, 1);
    assert.equal(entry?.won, 1);
  }
});

test("owner grouping uses assignedUserId, not UserRole — ADMIN/MANAGER/COMMERCIAL owners all participate identically", () => {
  const roles: UserRole[] = ["ADMIN", "MANAGER", "COMMERCIAL"];
  const prospects = roles.map((role, index) =>
    prospectRow({
      assignedUserId: `owner-${index}`,
      assignedUser: { firstName: role, lastName: "Owner" },
    }),
  );

  const analytics = buildSalesFunnelAnalytics(PERIOD, prospects, []);
  assert.equal(analytics.byOwner.length, 3);
  for (const entry of analytics.byOwner) {
    assert.equal(entry.total, 1);
  }
});

test("byOwner is sorted alphabetically by name, never by volume — no ranking implied", () => {
  const prospects = [
    ...Array.from({ length: 5 }, () =>
      prospectRow({ assignedUserId: "owner-z", assignedUser: { firstName: "Zenabo", lastName: "Z" } }),
    ),
    prospectRow({ assignedUserId: "owner-a", assignedUser: { firstName: "Awa", lastName: "A" } }),
  ];
  const analytics = buildSalesFunnelAnalytics(PERIOD, prospects, []);
  assert.deepEqual(
    analytics.byOwner.map((entry) => entry.ownerName),
    ["Awa A", "Zenabo Z"],
  );
});

// ---------------------------------------------------------------------------
// Interest semantics — must match Ticket 15H.4's Admin dashboard exactly
// ---------------------------------------------------------------------------

test("interestedProspects counts INTERESTED and READY_TO_DISCUSS only, matching the Admin dashboard KPI", () => {
  const interestLevels: InterestLevel[] = [
    "NOT_INTERESTED",
    "MAYBE",
    "NEEDS_INFORMATION",
    "INTERESTED",
    "READY_TO_DISCUSS",
  ];
  const prospects = interestLevels.map((interest) => prospectRow({ interest }));
  const analytics = buildSalesFunnelAnalytics(PERIOD, prospects, []);
  assert.equal(analytics.summary.interestedProspects, 2);
});

// ---------------------------------------------------------------------------
// Conversion rate denominators — never conflated
// ---------------------------------------------------------------------------

test("conversionRate is WON / total; closedWinRate is WON / (WON + LOST) — different numbers for the same data", () => {
  const prospects = [
    prospectRow({ status: "NEW" }),
    prospectRow({ status: "NEW" }),
    prospectRow({ status: "WON" }),
    prospectRow({ status: "LOST" }),
  ];
  const analytics = buildSalesFunnelAnalytics(PERIOD, prospects, []);

  assert.equal(analytics.summary.conversionRate, 25); // 1/4
  assert.equal(analytics.summary.closedWinRate, 50); // 1/(1+1)
  assert.notEqual(analytics.summary.conversionRate, analytics.summary.closedWinRate);
});

test("both rates are null (never NaN/Infinity) when their denominator is zero", () => {
  const analytics = buildSalesFunnelAnalytics(PERIOD, [], []);
  assert.equal(analytics.summary.conversionRate, null);
  assert.equal(analytics.summary.closedWinRate, null);
});

test("conversionRate is well-defined even with zero WON/LOST but nonzero total (closedWinRate is null in that case)", () => {
  const analytics = buildSalesFunnelAnalytics(PERIOD, [prospectRow({ status: "NEW" })], []);
  assert.equal(analytics.summary.conversionRate, 0);
  assert.equal(analytics.summary.closedWinRate, null);
});

// ---------------------------------------------------------------------------
// Historical outcomes — the ticket's exact worked example
// ---------------------------------------------------------------------------

test("outcome counts match exactly: ADVANCED 3, STALLED 2, WON 1, LOST 1", () => {
  const rows = [
    outcomeRow("ADVANCED"),
    outcomeRow("ADVANCED"),
    outcomeRow("ADVANCED"),
    outcomeRow("STALLED"),
    outcomeRow("STALLED"),
    outcomeRow("WON"),
    outcomeRow("LOST"),
  ];
  const analytics = buildSalesFunnelAnalytics(PERIOD, [], rows);
  assert.deepEqual(analytics.outcomes, {
    advanced: 3,
    stalled: 2,
    won: 1,
    lost: 1,
    structuredFollowUps: 7,
  });
});

test("zero structured outcomes never implies zero real advancement — the DTO just reports zero, the UI is responsible for the correct copy", () => {
  const analytics = buildSalesFunnelAnalytics(PERIOD, [prospectRow()], []);
  assert.equal(analytics.outcomes.structuredFollowUps, 0);
  assert.equal(analytics.outcomes.advanced, 0);
});

// ---------------------------------------------------------------------------
// No fake stage-transition analytics — guard against future regressions
// ---------------------------------------------------------------------------

test("the analytics DTO never includes a time-in-stage, stage-age, or stage-to-stage conversion field", () => {
  const analytics = buildSalesFunnelAnalytics(PERIOD, [prospectRow()], []);
  const serialized = JSON.stringify(analytics);
  assert.doesNotMatch(serialized, /updatedAt/i);
  assert.doesNotMatch(serialized, /timeInStage/i);
  assert.doesNotMatch(serialized, /stageAge/i);
  assert.doesNotMatch(serialized, /transitionRate/i);
});

test("SalesFunnelProspectRow never carries updatedAt — the aggregation core has no field to misuse as a stage-entered timestamp", () => {
  const row = prospectRow();
  assert.equal("updatedAt" in row, false);
});
