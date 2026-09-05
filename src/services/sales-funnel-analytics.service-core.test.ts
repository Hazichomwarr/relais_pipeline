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
  type SalesFunnelHistoricalOutcomeRow,
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

let nextEventOccurredAt = new Date("2026-08-01T00:00:00.000Z").getTime();

function historicalWonRow(
  overrides: Partial<SalesFunnelHistoricalOutcomeRow> = {},
): SalesFunnelHistoricalOutcomeRow {
  nextEventOccurredAt += 1000;
  return {
    prospectId: "prospect-won",
    type: "WON_TRANSITION",
    occurredAt: new Date(nextEventOccurredAt),
    creditedUserId: "jean",
    creditedUserNameAtEvent: "Jean Imain N’DO",
    responsibleUserIdAtEvent: "jean",
    responsibleUserAtEvent: null,
    ...overrides,
  };
}

function historicalLostRow(
  overrides: Partial<SalesFunnelHistoricalOutcomeRow> = {},
): SalesFunnelHistoricalOutcomeRow {
  nextEventOccurredAt += 1000;
  return {
    prospectId: "prospect-lost",
    type: "FOLLOW_UP",
    occurredAt: new Date(nextEventOccurredAt),
    creditedUserId: null,
    creditedUserNameAtEvent: null,
    responsibleUserIdAtEvent: "jean",
    responsibleUserAtEvent: { firstName: "Jean", lastName: "Imain N’DO" },
    ...overrides,
  };
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

test("a prospect owned by a since-promoted Commercial (now MANAGER) still appears attributed to that owner — SalesFunnelProspectRow carries no role field, so a role transition cannot affect this aggregation (Ticket 21A)", () => {
  const prospects = [
    prospectRow({ assignedUserId: "amidou", assignedUser: { firstName: "Amidou", lastName: "Sawadogo" } }),
    prospectRow({ assignedUserId: "amidou", assignedUser: { firstName: "Amidou", lastName: "Sawadogo" } }),
    prospectRow({ assignedUserId: "amidou", assignedUser: { firstName: "Amidou", lastName: "Sawadogo" } }),
  ];
  const analytics = buildSalesFunnelAnalytics(PERIOD, prospects, []);
  const amidou = analytics.byOwner.find((entry) => entry.ownerUserId === "amidou");

  assert.ok(amidou, "Amidou's 3 prospects must still be attributed to him after his role changed");
  assert.equal(amidou?.total, 3);
  assert.equal(amidou?.ownerName, "Amidou Sawadogo");
});

test("SalesFunnelProspectRow has no role field to misuse as an owner-eligibility filter", () => {
  const row = prospectRow();
  assert.equal("role" in row, false);
  assert.equal(row.assignedUser === null || !("role" in row.assignedUser), true);
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

// ---------------------------------------------------------------------------
// Ticket 28A.1 — historical WON/LOST attribution survives a future
// reassignment. These are the acceptance proof for the exact bug 28A found.
// ---------------------------------------------------------------------------

test("REGRESSION (Ticket 28A's exact bug): a prospect's historical WON credit stays with the original commercial even though the prospect is now assigned to someone else", () => {
  const prospects = [
    prospectRow({
      id: "prospect-won",
      status: "WON",
      // Simulates the world AFTER a future reassignment: current owner is
      // Amidou, but the win was recorded while Jean owned it.
      assignedUserId: "amidou",
      assignedUser: { firstName: "Amidou", lastName: "Sawadogo" },
    }),
  ];
  const historicalOutcomeEvents = [historicalWonRow({ prospectId: "prospect-won" })];

  const analytics = buildSalesFunnelAnalytics(PERIOD, prospects, [], historicalOutcomeEvents);

  const jean = analytics.byOwner.find((entry) => entry.ownerUserId === "jean");
  const amidou = analytics.byOwner.find((entry) => entry.ownerUserId === "amidou");

  assert.ok(jean, "Jean must still have a byOwner row even though he owns nothing today");
  assert.equal(jean?.won, 1, "the WON credit must stay with Jean, the historically responsible commercial");
  assert.equal(jean?.total, 0, "Jean's CURRENT portfolio is correctly empty — he owns nothing today");

  assert.equal(amidou?.total, 1, "Amidou's CURRENT portfolio correctly includes the reassigned prospect");
  assert.equal(amidou?.won ?? 0, 0, "Amidou must NOT receive historical WON credit merely by owning the prospect today");
});

test("REGRESSION: a prospect's historical LOST attribution stays with the original commercial after reassignment", () => {
  const prospects = [
    prospectRow({
      id: "prospect-lost",
      status: "LOST",
      assignedUserId: "amidou",
      assignedUser: { firstName: "Amidou", lastName: "Sawadogo" },
    }),
  ];
  const historicalOutcomeEvents = [historicalLostRow({ prospectId: "prospect-lost" })];

  const analytics = buildSalesFunnelAnalytics(PERIOD, prospects, [], historicalOutcomeEvents);

  const jean = analytics.byOwner.find((entry) => entry.ownerUserId === "jean");
  const amidou = analytics.byOwner.find((entry) => entry.ownerUserId === "amidou");

  assert.equal(jean?.lost, 1, "LOST attribution must stay with Jean via responsibleUserIdAtEvent");
  assert.equal(amidou?.lost ?? 0, 0, "Amidou must not inherit historical LOST attribution");
});

test("WON attribution is sourced from creditedUserId, LOST from responsibleUserIdAtEvent — never from Prospect.assignedUserId", () => {
  const prospects = [
    prospectRow({ id: "p-won", status: "WON", assignedUserId: "current-owner" }),
    prospectRow({ id: "p-lost", status: "LOST", assignedUserId: "current-owner" }),
  ];
  const historicalOutcomeEvents = [
    historicalWonRow({ prospectId: "p-won", creditedUserId: "jean", responsibleUserIdAtEvent: "someone-else" }),
    historicalLostRow({ prospectId: "p-lost", responsibleUserIdAtEvent: "amidou", creditedUserId: null }),
  ];

  const analytics = buildSalesFunnelAnalytics(PERIOD, prospects, [], historicalOutcomeEvents);

  assert.equal(analytics.byOwner.find((e) => e.ownerUserId === "jean")?.won, 1);
  assert.equal(analytics.byOwner.find((e) => e.ownerUserId === "amidou")?.lost, 1);
  const currentOwner = analytics.byOwner.find((e) => e.ownerUserId === "current-owner");
  assert.ok(currentOwner, "current-owner still gets a row for their live portfolio");
  assert.equal(currentOwner?.won, 0, "current-owner must not inherit Jean's WON credit merely by owning the prospect today");
  assert.equal(currentOwner?.lost, 0, "current-owner must not inherit Amidou's LOST attribution merely by owning the prospect today");
});

test("a commercial fully reassigned away from every prospect they ever closed still appears with their historical won/lost counts, not silently dropped", () => {
  const prospects = [
    prospectRow({ id: "prospect-won", status: "WON", assignedUserId: "amidou" }),
  ];
  const historicalOutcomeEvents = [historicalWonRow({ prospectId: "prospect-won" })];

  const analytics = buildSalesFunnelAnalytics(PERIOD, prospects, [], historicalOutcomeEvents);
  const jean = analytics.byOwner.find((entry) => entry.ownerUserId === "jean");

  assert.ok(jean, "a commercial with zero current prospects must still get a row for their historical credit");
  assert.equal(jean?.ownerName, "Jean Imain N’DO");
  assert.equal(jean?.won, 1);
});

test("stale historical events are ignored when the prospect's current status has moved on — only the event matching the CURRENT status counts", () => {
  // Prospect was won once (credited to Jean), then somehow reopened and is
  // now LOST, attributed at that later moment to Amidou. No enforced status
  // state machine prevents this (Ticket 20A) — the aggregation must not
  // double-count or use the stale WON row now that status is LOST.
  const prospects = [
    prospectRow({ id: "prospect-x", status: "LOST", assignedUserId: "amidou" }),
  ];
  const historicalOutcomeEvents = [
    historicalWonRow({
      prospectId: "prospect-x",
      creditedUserId: "jean",
      occurredAt: new Date("2026-08-01T00:00:00.000Z"),
    }),
    historicalLostRow({
      prospectId: "prospect-x",
      responsibleUserIdAtEvent: "amidou",
      occurredAt: new Date("2026-08-10T00:00:00.000Z"),
    }),
  ];

  const analytics = buildSalesFunnelAnalytics(PERIOD, prospects, [], historicalOutcomeEvents);

  assert.equal(analytics.byOwner.find((e) => e.ownerUserId === "jean"), undefined, "the stale WON row must not surface now that the prospect is LOST");
  assert.equal(analytics.byOwner.find((e) => e.ownerUserId === "amidou")?.lost, 1);
});

test("only the latest matching historical event counts when a prospect has more than one WON_TRANSITION row", () => {
  const prospects = [
    prospectRow({ id: "prospect-x", status: "WON", assignedUserId: "amidou" }),
  ];
  const historicalOutcomeEvents = [
    historicalWonRow({
      prospectId: "prospect-x",
      creditedUserId: "jean",
      occurredAt: new Date("2026-08-01T00:00:00.000Z"),
    }),
    historicalWonRow({
      prospectId: "prospect-x",
      creditedUserId: "amidou",
      occurredAt: new Date("2026-08-15T00:00:00.000Z"),
    }),
  ];

  const analytics = buildSalesFunnelAnalytics(PERIOD, prospects, [], historicalOutcomeEvents);

  assert.equal(analytics.byOwner.find((e) => e.ownerUserId === "jean")?.won ?? 0, 0);
  assert.equal(analytics.byOwner.find((e) => e.ownerUserId === "amidou")?.won, 1);
});

test("an unassigned-at-WON-time credit is bucketed as Non attribué, never fabricated to the current owner or any actor", () => {
  const prospects = [
    prospectRow({ id: "prospect-x", status: "WON", assignedUserId: "current-owner" }),
  ];
  const historicalOutcomeEvents = [
    historicalWonRow({
      prospectId: "prospect-x",
      creditedUserId: null,
      creditedUserNameAtEvent: null,
    }),
  ];

  const analytics = buildSalesFunnelAnalytics(PERIOD, prospects, [], historicalOutcomeEvents);
  const unassigned = analytics.byOwner.find((e) => e.ownerUserId === null);

  assert.ok(unassigned);
  assert.equal(unassigned?.won, 1);
  assert.equal(unassigned?.ownerName, "Non attribué");
  assert.equal(analytics.byOwner.find((e) => e.ownerUserId === "current-owner")?.won ?? 0, 0);
});

test("current-portfolio fields (total/interested/qualified/proposalSent) remain sourced from live assignedUserId, fully decoupled from historical won/lost", () => {
  const prospects = [
    prospectRow({
      id: "prospect-x",
      status: "WON",
      interest: "READY_TO_DISCUSS",
      assignedUserId: "amidou",
      assignedUser: { firstName: "Amidou", lastName: "Sawadogo" },
    }),
  ];
  const historicalOutcomeEvents = [historicalWonRow({ prospectId: "prospect-x", creditedUserId: "jean" })];

  const analytics = buildSalesFunnelAnalytics(PERIOD, prospects, [], historicalOutcomeEvents);
  const amidou = analytics.byOwner.find((e) => e.ownerUserId === "amidou");

  assert.equal(amidou?.total, 1);
  assert.equal(amidou?.interested, 1);
  assert.equal(amidou?.won, 0);
});

test("reconciliation: summary.wonProspects/lostProspects and outcomes.won/lost are unaffected by historicalOutcomeEvents — only byOwner's attribution source changed", () => {
  const prospects = [
    prospectRow({ status: "WON", assignedUserId: "amidou" }),
    prospectRow({ status: "LOST", assignedUserId: "amidou" }),
  ];
  const outcomeRows = [outcomeRow("WON"), outcomeRow("LOST")];
  const historicalOutcomeEvents = [historicalWonRow(), historicalLostRow()];

  const withHistory = buildSalesFunnelAnalytics(PERIOD, prospects, outcomeRows, historicalOutcomeEvents);
  const withoutHistory = buildSalesFunnelAnalytics(PERIOD, prospects, outcomeRows, []);

  assert.deepEqual(withHistory.summary, withoutHistory.summary);
  assert.deepEqual(withHistory.outcomes, withoutHistory.outcomes);
  assert.deepEqual(withHistory.byProduct, withoutHistory.byProduct);
});

test("historicalOutcomeEvents defaults to an empty array — every pre-28A.1 call site keeps compiling and behaving as before (won/lost simply resolve to 0 or absent, never a crash)", () => {
  const analytics = buildSalesFunnelAnalytics(PERIOD, [prospectRow({ status: "WON" })], []);
  assert.equal(analytics.byOwner[0]?.won, 0);
});

// ---------------------------------------------------------------------------
// Ticket 28A.1 — no automatic repair / no runtime fallback regression guard
// ---------------------------------------------------------------------------

test("never falls back from missing historical attribution to the prospect's current assignedUserId — unknown stays unknown", () => {
  const prospects = [
    prospectRow({ id: "prospect-x", status: "WON", assignedUserId: "current-owner" }),
  ];
  // No historicalOutcomeEvents at all for this WON prospect — simulates a
  // legacy row that predates Ticket 28A.1 and was never backfilled.
  const analytics = buildSalesFunnelAnalytics(PERIOD, prospects, [], []);

  assert.equal(analytics.byOwner.find((e) => e.ownerUserId === "current-owner")?.won ?? 0, 0);
  assert.equal(analytics.byOwner.length, 1, "no phantom historical bucket is fabricated for a legacy row with no recorded event");
});
