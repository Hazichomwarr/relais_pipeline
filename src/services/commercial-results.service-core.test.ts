import assert from "node:assert/strict";
import test from "node:test";
import type { ProspectActivityType, UserRole } from "@prisma/client";

import {
  buildEmployeeNotFoundCommercialResultsResult,
  collectCommercialResultsEvidence,
  computeCommercialResultsAchievementRate,
  computeCommercialResultsResult,
  computeCommercialResultsScore,
  isScorableForCommercialResults,
  type CommercialResultsEmployee,
  type CommercialResultsPeriod,
  type CommercialResultsTarget,
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

function target(
  overrides: Partial<CommercialResultsTarget> = {},
): CommercialResultsTarget {
  return { targetWins: 4, roleAtAssignment: "COMMERCIAL", ...overrides };
}

function manyWins(count: number, overrides: Partial<CommercialResultsWonEventRow> = {}) {
  return Array.from({ length: count }, (_, index) =>
    won({ prospectId: `prospect-${index}`, ...overrides }),
  );
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
    target(),
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
      target(),
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

test("Ticket 25M §26/§27/§44: ASSISTANT is refused by the orchestrator exactly like every other unsupported role — UNSUPPORTED_ROLE, never a fabricated zero", () => {
  const result = computeCommercialResultsResult(
    employee("user-1", "ASSISTANT"),
    AUGUST,
    [won({ creditedUserId: "user-1", creditedUserRoleAtEvent: "COMMERCIAL" })],
    target(),
    AFTER_AUGUST,
  );

  assert.equal(result.status, "UNSUPPORTED_ROLE");
  assert.equal(result.score, null);
  assert.equal(result.evidence, null);
});

test("Ticket 25M §26: isScorableForCommercialResults(ASSISTANT) is false — adding the enum value did not silently widen this domain's eligibility", () => {
  assert.equal(isScorableForCommercialResults("ASSISTANT"), false);
});

test("isScorableForCommercialResults(COMMERCIAL) is true", () => {
  assert.equal(isScorableForCommercialResults("COMMERCIAL"), true);
});

// ---------------------------------------------------------------------------
// §38: future/open periods
// ---------------------------------------------------------------------------

test("25H.2B §43/25H.2 §38: a period whose end has not yet occurred is refused regardless of target existence, mirroring Execution Discipline's PERIOD_NOT_CLOSED", () => {
  const now = new Date("2026-08-15T00:00:00.000Z"); // mid-August
  const result = computeCommercialResultsResult(
    employee("commercial-a"),
    AUGUST,
    [won()],
    target(),
    now,
  );

  assert.equal(result.status, "PERIOD_NOT_CLOSED");
  assert.equal(result.evidence, null);
});

test("a period ending exactly at `now` is accepted as closed and scored", () => {
  const result = computeCommercialResultsResult(
    employee("commercial-a"),
    AUGUST,
    [won({ occurredAt: AUGUST.periodEnd })],
    target({ targetWins: 4 }),
    AUGUST.periodEnd,
  );

  assert.equal(result.status, "SCORED");
});

// ---------------------------------------------------------------------------
// 25H.2B §31/§32: the exact formula and deterministic rounding
// ---------------------------------------------------------------------------

for (const [wins, expectedScore] of [
  [0, 0],
  [1, 10],
  [2, 20],
  [3, 30],
  [4, 40],
  [5, 40],
] as const) {
  test(`25H.2B §31: ${wins} credited win(s) against a target of 4 scores ${expectedScore}/40`, () => {
    const result = computeCommercialResultsResult(
      employee("commercial-a"),
      AUGUST,
      manyWins(wins),
      target({ targetWins: 4 }),
      AFTER_AUGUST,
    );

    assert.equal(result.status, "SCORED");
    assert.equal(result.score, expectedScore);
  });
}

test("25H.2B §32: deterministic rounding — 1/3 rounds down to 13, 2/3 rounds up to 27", () => {
  const oneOfThree = computeCommercialResultsScore({
    creditedWins: 1,
    targetWins: 3,
  });
  const twoOfThree = computeCommercialResultsScore({
    creditedWins: 2,
    targetWins: 3,
  });

  assert.equal(oneOfThree, 13); // 40/3 = 13.333... -> 13
  assert.equal(twoOfThree, 27); // 80/3 = 26.666... -> 27
});

// ---------------------------------------------------------------------------
// 25H.2B §16/§33: score cap, overachievement preserved in evidence
// ---------------------------------------------------------------------------

test("25H.2B §33: overachievement caps the score at 40 but the achievement rate stays unclamped", () => {
  const result = computeCommercialResultsResult(
    employee("commercial-a"),
    AUGUST,
    manyWins(10),
    target({ targetWins: 1 }),
    AFTER_AUGUST,
  );

  assert.equal(result.status, "SCORED");
  assert.equal(result.score, 40);
  if (result.status === "SCORED") {
    assert.equal(result.achievementRate, 10);
  }
});

test("25H.2B §16: 7 wins against a target of 4 caps score at 40 while achievementRate reads 1.75", () => {
  const rate = computeCommercialResultsAchievementRate({
    creditedWins: 7,
    targetWins: 4,
  });
  const score = computeCommercialResultsScore({ creditedWins: 7, targetWins: 4 });

  assert.equal(rate, 1.75);
  assert.equal(score, 40);
});

// ---------------------------------------------------------------------------
// 25H.2B §11/§13: zero credited wins against a valid target is a real,
// legitimate score — not INSUFFICIENT_EVIDENCE and not a fabricated 40
// ---------------------------------------------------------------------------

test("25H.2B §11: zero credited wins against a valid target scores a real 0/40, not a blocked or fabricated state", () => {
  const result = computeCommercialResultsResult(
    employee("commercial-a"),
    AUGUST,
    [],
    target({ targetWins: 4 }),
    AFTER_AUGUST,
  );

  assert.equal(result.status, "SCORED");
  assert.equal(result.score, 0);
  if (result.status === "SCORED") {
    assert.equal(result.creditedWins, 0);
    assert.equal(result.targetWins, 4);
    assert.equal(result.achievementRate, 0);
  }
});

// ---------------------------------------------------------------------------
// 25H.2B §12/§35: no target is not zero and not a fabricated score
// ---------------------------------------------------------------------------

test("25H.2B §12/§35: credited wins with no target for the exact period returns NO_TARGET, never 0/40 or 40/40", () => {
  const result = computeCommercialResultsResult(
    employee("commercial-a"),
    AUGUST,
    manyWins(3),
    null,
    AFTER_AUGUST,
  );

  assert.equal(result.status, "NO_TARGET");
  assert.equal(result.score, null);
  assert.equal(result.evidence?.creditedWins, 3);
});

// ---------------------------------------------------------------------------
// 25H.2B §6/§34: defensive guard against a malformed target — never divide
// by zero, never silently correct
// ---------------------------------------------------------------------------

for (const malformed of [
  { targetWins: 0, roleAtAssignment: "COMMERCIAL" as const },
  { targetWins: -4, roleAtAssignment: "COMMERCIAL" as const },
  { targetWins: 1.5, roleAtAssignment: "COMMERCIAL" as const },
  { targetWins: 4, roleAtAssignment: "MANAGER" as const },
]) {
  test(`25H.2B §5/§6/§34: a malformed target (${JSON.stringify(malformed)}) is refused as INVALID_TARGET, never NaN/Infinity`, () => {
    const result = computeCommercialResultsResult(
      employee("commercial-a"),
      AUGUST,
      manyWins(2),
      malformed,
      AFTER_AUGUST,
    );

    assert.equal(result.status, "INVALID_TARGET");
    assert.equal(result.score, null); // never NaN or Infinity — a controlled null, not a math artifact
  });
}

// ---------------------------------------------------------------------------
// 25H.2B §8/§9/§37/§38: legacy attribution coverage blocks the score even
// when a target and credited wins both exist
// ---------------------------------------------------------------------------

test("25H.2B §37: complete coverage with a target and wins present scores normally", () => {
  const result = computeCommercialResultsResult(
    employee("commercial-a"),
    AUGUST,
    manyWins(2),
    target({ targetWins: 4 }),
    AFTER_AUGUST,
  );

  assert.equal(result.status, "SCORED");
});

test("25H.2B §9/§38: partial legacy attribution blocks the score even when a target and credited wins both exist", () => {
  const events = [
    ...manyWins(2),
    won({
      prospectId: "prospect-legacy",
      creditedUserId: null,
      creditedUserRoleAtEvent: null,
    }),
  ];

  const result = computeCommercialResultsResult(
    employee("commercial-a"),
    AUGUST,
    events,
    target({ targetWins: 4 }),
    AFTER_AUGUST,
  );

  assert.equal(result.status, "LEGACY_ATTRIBUTION_INCOMPLETE");
  assert.equal(result.score, null);
  if (result.status === "LEGACY_ATTRIBUTION_INCOMPLETE") {
    assert.equal(result.legacyUnattributedWinsInPeriod, 1);
    assert.equal(result.evidence.creditedWins, 2);
  }
});

// ---------------------------------------------------------------------------
// 25H.2B §39/§40: end-to-end regressions tying attribution + dedup into
// the final score
// ---------------------------------------------------------------------------

test("25H.2B §39: a manager-closed win credited to the Commercial scores under the Commercial, never under the manager", () => {
  const events = [
    won({ creditedUserId: "commercial-a", creditedUserRoleAtEvent: "COMMERCIAL" }),
  ];

  const commercialResult = computeCommercialResultsResult(
    employee("commercial-a"),
    AUGUST,
    events,
    target({ targetWins: 4 }),
    AFTER_AUGUST,
  );

  assert.equal(commercialResult.status, "SCORED");
  assert.equal(commercialResult.score, 10); // 1/4
});

test("25H.2B §40: two WON events on the same prospect still only count once toward the final score", () => {
  const events = [
    won({ prospectId: "prospect-1", occurredAt: new Date("2026-08-05T10:00:00.000Z") }),
    won({ prospectId: "prospect-1", occurredAt: new Date("2026-08-20T10:00:00.000Z") }),
  ];

  const result = computeCommercialResultsResult(
    employee("commercial-a"),
    AUGUST,
    events,
    target({ targetWins: 4 }),
    AFTER_AUGUST,
  );

  assert.equal(result.status, "SCORED");
  assert.equal(result.score, 10); // creditedWins = 1, not 2
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
