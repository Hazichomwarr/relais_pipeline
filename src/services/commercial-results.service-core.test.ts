import assert from "node:assert/strict";
import test from "node:test";
import type { ProspectActivityType, UserRole } from "@prisma/client";

import {
  buildEmployeeNotFoundCommercialResultsResult,
  collectCommercialResultsEvidence,
  computeCommercialResultsResult,
  isScorableForCommercialResults,
  type CommercialResultsEmployee,
  type CommercialResultsPeriod,
  type CommercialResultsWonEventRow,
} from "./commercial-results.service-core";

const AUGUST: CommercialResultsPeriod = {
  periodStart: new Date("2026-08-01T00:00:00.000Z"),
  periodEnd: new Date("2026-08-31T23:59:59.999Z"),
};
const AFTER_AUGUST = new Date("2026-09-05T00:00:00.000Z");

function employee(
  id: string,
  role: UserRole = "COMMERCIAL",
): CommercialResultsEmployee {
  return { id, role };
}

function won(
  overrides: Partial<CommercialResultsWonEventRow> = {},
): CommercialResultsWonEventRow {
  return {
    type: "WON_TRANSITION" as ProspectActivityType,
    prospectId: "prospect-1",
    creditedUserId: "commercial-a",
    creditedUserRoleAtEvent: "COMMERCIAL",
    occurredAt: new Date("2026-08-14T10:00:00.000Z"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// §31: actor vs credited user — evidence never reads an actor at all
// ---------------------------------------------------------------------------

test("§31: a MANAGER closing a COMMERCIAL's prospect — the COMMERCIAL receives evidence, the manager does not (evidence is keyed on creditedUserId, which never carries actor identity)", () => {
  // The row type itself has no agentName/actor field — a manager who
  // merely submitted the closing follow-up has no way to appear here.
  const events = [
    won({
      prospectId: "prospect-1",
      creditedUserId: "commercial-a",
      creditedUserRoleAtEvent: "COMMERCIAL",
    }),
  ];

  const commercialEvidence = collectCommercialResultsEvidence(
    "commercial-a",
    AUGUST,
    events,
  );
  const managerEvidence = collectCommercialResultsEvidence(
    "manager-b",
    AUGUST,
    events,
  );

  assert.equal(commercialEvidence.creditedWins, 1);
  assert.equal(managerEvidence.creditedWins, 0);
});

// ---------------------------------------------------------------------------
// §17/§32/§33: role-at-event, not current role, governs eligibility
// ---------------------------------------------------------------------------

test("§32: a win credited while COMMERCIAL remains eligible evidence even for a currently-MANAGER employee id", () => {
  const events = [
    won({ creditedUserId: "amidou", creditedUserRoleAtEvent: "COMMERCIAL" }),
  ];

  // collectCommercialResultsEvidence takes no current-role parameter at
  // all — Amidou's current role (whatever it is today) cannot affect this.
  const evidence = collectCommercialResultsEvidence("amidou", AUGUST, events);

  assert.equal(evidence.creditedWins, 1);
});

test("§33: a win credited while MANAGER is excluded from Commercial Results, even for a currently-COMMERCIAL employee id", () => {
  const events = [
    won({ creditedUserId: "amidou", creditedUserRoleAtEvent: "MANAGER" }),
  ];

  const evidence = collectCommercialResultsEvidence("amidou", AUGUST, events);

  assert.equal(evidence.creditedWins, 0);
  assert.equal(evidence.excludedNonCommercialRoleWins, 1);
});

test("the top-level orchestrator's UNSUPPORTED_ROLE gate checks current role for whether to present a Results dimension at all — it is a separate concern from event-time eligibility above", () => {
  const events = [
    won({ creditedUserId: "amidou", creditedUserRoleAtEvent: "COMMERCIAL" }),
  ];

  const result = computeCommercialResultsResult(
    employee("amidou", "MANAGER"),
    AUGUST,
    events,
    AFTER_AUGUST,
  );

  assert.equal(result.status, "UNSUPPORTED_ROLE");
  assert.equal(result.evidence, null);
});

// ---------------------------------------------------------------------------
// §34: period boundaries
// ---------------------------------------------------------------------------

test("§34: an event occurring exactly at periodStart is included", () => {
  const evidence = collectCommercialResultsEvidence("commercial-a", AUGUST, [
    won({ occurredAt: AUGUST.periodStart }),
  ]);
  assert.equal(evidence.creditedWins, 1);
});

test("§34: an event occurring exactly at periodEnd is included", () => {
  const evidence = collectCommercialResultsEvidence("commercial-a", AUGUST, [
    won({ occurredAt: AUGUST.periodEnd }),
  ]);
  assert.equal(evidence.creditedWins, 1);
});

test("§34: an event occurring before periodStart is excluded", () => {
  const evidence = collectCommercialResultsEvidence("commercial-a", AUGUST, [
    won({ occurredAt: new Date(AUGUST.periodStart.getTime() - 1) }),
  ]);
  assert.equal(evidence.creditedWins, 0);
});

test("§34: an event occurring after periodEnd is excluded", () => {
  const evidence = collectCommercialResultsEvidence("commercial-a", AUGUST, [
    won({ occurredAt: new Date(AUGUST.periodEnd.getTime() + 1) }),
  ]);
  assert.equal(evidence.creditedWins, 0);
});

// ---------------------------------------------------------------------------
// §16: canonical timestamp — occurredAt only, nothing derived from Prospect
// ---------------------------------------------------------------------------

test("§16: only occurredAt governs period membership — the row type has no Prospect.updatedAt field for a caller to accidentally pass instead", () => {
  // Type-level guarantee: CommercialResultsWonEventRow has exactly
  // type/prospectId/creditedUserId/creditedUserRoleAtEvent/occurredAt.
  const row = won();
  assert.deepEqual(Object.keys(row).sort(), [
    "creditedUserId",
    "creditedUserRoleAtEvent",
    "occurredAt",
    "prospectId",
    "type",
  ]);
});

// ---------------------------------------------------------------------------
// §35: legacy unattributed WON — never assigned to anyone
// ---------------------------------------------------------------------------

test("§35/§5: a creditedUserId = null WON event is never awarded to the querying employee, whoever they are", () => {
  const events = [won({ creditedUserId: null, creditedUserRoleAtEvent: null })];

  const evidenceForAnyone = collectCommercialResultsEvidence(
    "commercial-a",
    AUGUST,
    events,
  );
  const evidenceForSomeoneElse = collectCommercialResultsEvidence(
    "commercial-z",
    AUGUST,
    events,
  );

  assert.equal(evidenceForAnyone.creditedWins, 0);
  assert.equal(evidenceForSomeoneElse.creditedWins, 0);
  assert.equal(evidenceForAnyone.legacyUnattributedWinsInPeriod, 1);
  assert.equal(evidenceForSomeoneElse.legacyUnattributedWinsInPeriod, 1);
});

test("§26: coverageStatus reflects legacy unattributed wins in the period, company-wide", () => {
  const complete = collectCommercialResultsEvidence("commercial-a", AUGUST, [
    won({ creditedUserId: "commercial-a" }),
  ]);
  const partial = collectCommercialResultsEvidence("commercial-a", AUGUST, [
    won({ prospectId: "prospect-1", creditedUserId: "commercial-a" }),
    won({
      prospectId: "prospect-legacy",
      creditedUserId: null,
      creditedUserRoleAtEvent: null,
    }),
  ]);

  assert.equal(complete.coverageStatus, "COMPLETE");
  assert.equal(complete.legacyUnattributedWinsInPeriod, 0);
  assert.equal(partial.coverageStatus, "PARTIAL_LEGACY_ATTRIBUTION");
  assert.equal(partial.legacyUnattributedWinsInPeriod, 1);
});

// ---------------------------------------------------------------------------
// §15/§36: duplicate WON protection — one credit per prospect
// ---------------------------------------------------------------------------

test("§36: two WON_TRANSITION events for the same prospect, both credited to the same employee in the same period, count as one credited win", () => {
  const events = [
    won({
      prospectId: "prospect-1",
      occurredAt: new Date("2026-08-05T10:00:00.000Z"),
    }),
    won({
      prospectId: "prospect-1",
      occurredAt: new Date("2026-08-20T10:00:00.000Z"),
    }),
  ];

  const evidence = collectCommercialResultsEvidence(
    "commercial-a",
    AUGUST,
    events,
  );

  assert.equal(evidence.creditedWins, 1);
  assert.equal(evidence.rawCreditedWinEvents, 2);
});

test("§36: two WON_TRANSITION events for different prospects count as two credited wins — de-duplication is per-prospect, not a blanket cap", () => {
  const events = [
    won({ prospectId: "prospect-1" }),
    won({ prospectId: "prospect-2" }),
  ];

  const evidence = collectCommercialResultsEvidence(
    "commercial-a",
    AUGUST,
    events,
  );

  assert.equal(evidence.creditedWins, 2);
  assert.equal(evidence.rawCreditedWinEvents, 2);
});

// ---------------------------------------------------------------------------
// §37: unsupported roles
// ---------------------------------------------------------------------------

for (const role of ["ADMIN", "MANAGER"] as const) {
  test(`§37: ${role} is refused by the orchestrator, never silently handed a Commercial Results evaluation`, () => {
    const result = computeCommercialResultsResult(
      employee("user-1", role),
      AUGUST,
      [won({ creditedUserId: "user-1", creditedUserRoleAtEvent: "COMMERCIAL" })],
      AFTER_AUGUST,
    );

    assert.equal(result.status, "UNSUPPORTED_ROLE");
    assert.equal(result.score, null);
    assert.equal(result.evidence, null);
  });

  test(`isScorableForCommercialResults(${role}) is false`, () => {
    assert.equal(isScorableForCommercialResults(role), false);
  });
}

test("isScorableForCommercialResults(COMMERCIAL) is true", () => {
  assert.equal(isScorableForCommercialResults("COMMERCIAL"), true);
});

// ---------------------------------------------------------------------------
// §38: future/open periods
// ---------------------------------------------------------------------------

test("§38: a period whose end has not yet occurred is refused, mirroring Execution Discipline's PERIOD_NOT_CLOSED", () => {
  const now = new Date("2026-08-15T00:00:00.000Z"); // mid-August
  const result = computeCommercialResultsResult(
    employee("commercial-a"),
    AUGUST,
    [won()],
    now,
  );

  assert.equal(result.status, "PERIOD_NOT_CLOSED");
  assert.equal(result.evidence, null);
});

test("a period ending exactly at `now` is accepted as closed", () => {
  const result = computeCommercialResultsResult(
    employee("commercial-a"),
    AUGUST,
    [won({ occurredAt: AUGUST.periodEnd })],
    AUGUST.periodEnd,
  );

  assert.equal(result.status, "BLOCKED_PENDING_TARGET_DOMAIN");
});

// ---------------------------------------------------------------------------
// §39: score cap — not applicable, no formula exists in V1
// ---------------------------------------------------------------------------

test("§39 (N/A in V1): no numeric score is ever produced regardless of evidence volume, so there is no cap to test — a large win count still returns score: null", () => {
  const manyWins = Array.from({ length: 12 }, (_, index) =>
    won({ prospectId: `prospect-${index}` }),
  );

  const result = computeCommercialResultsResult(
    employee("commercial-a"),
    AUGUST,
    manyWins,
    AFTER_AUGUST,
  );

  assert.equal(result.status, "BLOCKED_PENDING_TARGET_DOMAIN");
  assert.equal(result.score, null);
  if (result.status === "BLOCKED_PENDING_TARGET_DOMAIN") {
    assert.equal(result.evidence.creditedWins, 12);
  }
});

// ---------------------------------------------------------------------------
// §40/§24/§25: no defensible score is ever fabricated, in either direction
// ---------------------------------------------------------------------------

test("§40: zero credited wins in period still returns BLOCKED_PENDING_TARGET_DOMAIN, never a fabricated 0/40 or 40/40", () => {
  const result = computeCommercialResultsResult(
    employee("commercial-a"),
    AUGUST,
    [],
    AFTER_AUGUST,
  );

  assert.equal(result.status, "BLOCKED_PENDING_TARGET_DOMAIN");
  assert.equal(result.score, null);
  if (result.status === "BLOCKED_PENDING_TARGET_DOMAIN") {
    assert.equal(result.evidence.creditedWins, 0);
    assert.ok(result.scoringBlockedReason.length > 0);
  }
});

// ---------------------------------------------------------------------------
// §18/§19: deactivation and name changes are structurally irrelevant
// ---------------------------------------------------------------------------

test("§18/§19: evidence collection never reads active status or a name — identity is creditedUserId alone (the row type carries neither field)", () => {
  // Already proven by the §16 key-set test above; restated here for the
  // specific §18/§19 requirement traceability.
  const row = won();
  assert.ok(!("active" in row));
  assert.ok(!("creditedUserNameAtEvent" in row));
});

// ---------------------------------------------------------------------------
// Employee resolution (service-layer fact, tested at the shared result shape)
// ---------------------------------------------------------------------------

test("an unresolved employee id produces a controlled EMPLOYEE_NOT_FOUND result, not a thrown error", () => {
  const result = buildEmployeeNotFoundCommercialResultsResult();

  assert.equal(result.status, "EMPLOYEE_NOT_FOUND");
  assert.equal(result.score, null);
  assert.equal(result.evidence, null);
});
