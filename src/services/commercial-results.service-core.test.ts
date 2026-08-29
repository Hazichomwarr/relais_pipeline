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

test("Ticket 25P §47: a win credited while MANAGER now counts as Results evidence, even for a currently-COMMERCIAL employee id", () => {
  const events = [
    won({ creditedUserId: "amidou", creditedUserRoleAtEvent: "MANAGER" }),
  ];

  const evidence = collectCommercialResultsEvidence("amidou", AUGUST, events);

  assert.equal(evidence.creditedWins, 1);
  assert.equal(evidence.excludedIneligibleRoleWins, 0);
});

test("Ticket 25P §26/§27: a win credited while ADMIN remains excluded from Results evidence, even for a currently-MANAGER employee id", () => {
  const events = [
    won({ creditedUserId: "amidou", creditedUserRoleAtEvent: "ADMIN" }),
  ];

  const evidence = collectCommercialResultsEvidence("amidou", AUGUST, events);

  assert.equal(evidence.creditedWins, 0);
  assert.equal(evidence.excludedIneligibleRoleWins, 1);
});

test("Ticket 25P §25: a win credited while ASSISTANT remains excluded from Results evidence, even for a currently-MANAGER employee id", () => {
  const events = [
    won({ creditedUserId: "amidou", creditedUserRoleAtEvent: "ASSISTANT" }),
  ];

  const evidence = collectCommercialResultsEvidence("amidou", AUGUST, events);

  assert.equal(evidence.creditedWins, 0);
  assert.equal(evidence.excludedIneligibleRoleWins, 1);
});

test("the top-level orchestrator's UNSUPPORTED_ROLE gate checks current role for whether to present a Results dimension at all — it is a separate concern from event-time eligibility above", () => {
  const events = [
    won({ creditedUserId: "amidou", creditedUserRoleAtEvent: "COMMERCIAL" }),
  ];

  const result = computeCommercialResultsResult(
    employee("amidou", "ASSISTANT"),
    AUGUST,
    events,
    target(),
    AFTER_AUGUST,
  );

  assert.equal(result.status, "UNSUPPORTED_ROLE");
  assert.equal(result.evidence, null);
});

// ---------------------------------------------------------------------------
// Ticket 25P §22/§23/§48/§55: mixed-role and demotion periods
// ---------------------------------------------------------------------------

test("Ticket 25P §22/§48: a mixed-role period (2 COMMERCIAL-at-event + 2 MANAGER-at-event + 1 ADMIN-at-event + 1 ASSISTANT-at-event) credits exactly the 4 eligible wins, excluding the other 2", () => {
  const events = [
    won({ prospectId: "p1", creditedUserRoleAtEvent: "COMMERCIAL" }),
    won({ prospectId: "p2", creditedUserRoleAtEvent: "COMMERCIAL" }),
    won({ prospectId: "p3", creditedUserRoleAtEvent: "MANAGER" }),
    won({ prospectId: "p4", creditedUserRoleAtEvent: "MANAGER" }),
    won({ prospectId: "p5", creditedUserRoleAtEvent: "ADMIN" }),
    won({ prospectId: "p6", creditedUserRoleAtEvent: "ASSISTANT" }),
  ];

  const evidence = collectCommercialResultsEvidence(
    "commercial-a",
    AUGUST,
    events,
  );

  assert.equal(evidence.creditedWins, 4);
  assert.equal(evidence.excludedIneligibleRoleWins, 2);
});

test("Ticket 25P §23: a demotion within the period (MANAGER-at-event then COMMERCIAL-at-event) counts both sides — no role-transition penalty", () => {
  const events = [
    won({
      prospectId: "p1",
      creditedUserRoleAtEvent: "MANAGER",
      occurredAt: new Date("2026-08-05T10:00:00.000Z"),
    }),
    won({
      prospectId: "p2",
      creditedUserRoleAtEvent: "COMMERCIAL",
      occurredAt: new Date("2026-08-20T10:00:00.000Z"),
    }),
  ];

  const evidence = collectCommercialResultsEvidence(
    "commercial-a",
    AUGUST,
    events,
  );

  assert.equal(evidence.creditedWins, 2);
});

test("Ticket 25P §55: mixed-role wins (2 Commercial-at-event, 1 Manager-at-event) against one target of 4 score 30/40 with creditedWins = 3 — no period split", () => {
  const events = [
    won({ prospectId: "p1", creditedUserRoleAtEvent: "COMMERCIAL" }),
    won({ prospectId: "p2", creditedUserRoleAtEvent: "COMMERCIAL" }),
    won({ prospectId: "p3", creditedUserRoleAtEvent: "MANAGER" }),
  ];

  const result = computeCommercialResultsResult(
    employee("commercial-a"),
    AUGUST,
    events,
    target({ targetWins: 4 }),
    AFTER_AUGUST,
  );

  assert.equal(result.status, "SCORED");
  assert.equal(result.score, 30);
  if (result.status === "SCORED") {
    assert.equal(result.creditedWins, 3);
  }
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
// §37/Ticket 25P §46: unsupported vs. now-supported roles
// ---------------------------------------------------------------------------

for (const role of ["ADMIN", "ASSISTANT"] as const) {
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

test("Ticket 25P §46: the complete current-role subject matrix — COMMERCIAL and MANAGER are supported; ADMIN and ASSISTANT are not", () => {
  assert.equal(isScorableForCommercialResults("COMMERCIAL"), true);
  assert.equal(isScorableForCommercialResults("MANAGER"), true);
  assert.equal(isScorableForCommercialResults("ADMIN"), false);
  assert.equal(isScorableForCommercialResults("ASSISTANT"), false);
});

test("Ticket 25P §1/§4: MANAGER is no longer refused by the orchestrator — a MANAGER with valid evidence and a valid target now scores exactly like a COMMERCIAL would", () => {
  const result = computeCommercialResultsResult(
    employee("manager-1", "MANAGER"),
    AUGUST,
    [won({ creditedUserId: "manager-1", creditedUserRoleAtEvent: "MANAGER" })],
    target({ targetWins: 4, roleAtAssignment: "MANAGER" }),
    AFTER_AUGUST,
  );

  assert.equal(result.status, "SCORED");
  assert.equal(result.score, 10); // 1/4
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
  { targetWins: 4, roleAtAssignment: "ADMIN" as const },
  { targetWins: 4, roleAtAssignment: "ASSISTANT" as const },
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

test("Ticket 25P §1/§37: a target with roleAtAssignment = MANAGER is now a VALID target — this used to be INVALID_TARGET before 25P", () => {
  const result = computeCommercialResultsResult(
    employee("manager-a", "MANAGER"),
    AUGUST,
    manyWins(2, { creditedUserId: "manager-a", creditedUserRoleAtEvent: "MANAGER" }),
    { targetWins: 4, roleAtAssignment: "MANAGER" },
    AFTER_AUGUST,
  );

  assert.equal(result.status, "SCORED");
  assert.equal(result.score, 20); // 2/4
});

test("Ticket 25P §37/§54: a target snapshotted roleAtAssignment = COMMERCIAL remains valid for a since-promoted, currently-MANAGER employee — roleAtAssignment is historical metadata, not a live compatibility lock against the employee's current role", () => {
  const result = computeCommercialResultsResult(
    employee("promoted-a", "MANAGER"),
    AUGUST,
    manyWins(2, { creditedUserId: "promoted-a", creditedUserRoleAtEvent: "COMMERCIAL" }),
    { targetWins: 4, roleAtAssignment: "COMMERCIAL" },
    AFTER_AUGUST,
  );

  assert.equal(result.status, "SCORED");
  assert.equal(result.score, 20); // 2/4
});

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
// Ticket 25P §18-21/§49-51: Manager scoring — the unchanged /40 formula
// applied to a Manager subject, mirroring every Commercial-formula test
// above with no Manager-specific variant of the arithmetic.
// ---------------------------------------------------------------------------

test("Ticket 25P §18/§49: a current MANAGER with no exact target returns NO_TARGET, never UNSUPPORTED_ROLE", () => {
  const result = computeCommercialResultsResult(
    employee("manager-a", "MANAGER"),
    AUGUST,
    [],
    null,
    AFTER_AUGUST,
  );

  assert.equal(result.status, "NO_TARGET");
  assert.equal(result.score, null);
});

test("Ticket 25P §19: a current MANAGER with a valid target and zero credited wins scores a real 0/40 — zero is a legitimate score, not a blocked state", () => {
  const result = computeCommercialResultsResult(
    employee("manager-a", "MANAGER"),
    AUGUST,
    [],
    target({ targetWins: 4, roleAtAssignment: "MANAGER" }),
    AFTER_AUGUST,
  );

  assert.equal(result.status, "SCORED");
  assert.equal(result.score, 0);
  if (result.status === "SCORED") {
    assert.equal(result.achievementRate, 0);
  }
});

for (const [wins, expectedScore] of [
  [0, 0],
  [1, 10],
  [3, 30],
  [4, 40],
] as const) {
  test(`Ticket 25P §20/§50: a MANAGER with ${wins} credited win(s) against a target of 4 scores ${expectedScore}/40 — same formula as Commercial`, () => {
    const result = computeCommercialResultsResult(
      employee("manager-a", "MANAGER"),
      AUGUST,
      manyWins(wins, { creditedUserId: "manager-a", creditedUserRoleAtEvent: "MANAGER" }),
      target({ targetWins: 4, roleAtAssignment: "MANAGER" }),
      AFTER_AUGUST,
    );

    assert.equal(result.status, "SCORED");
    assert.equal(result.score, expectedScore);
  });
}

test("Ticket 25P §21: a MANAGER over target caps the score at 40 while achievementRate stays unclamped — no role-specific cap", () => {
  const result = computeCommercialResultsResult(
    employee("manager-a", "MANAGER"),
    AUGUST,
    manyWins(6, { creditedUserId: "manager-a", creditedUserRoleAtEvent: "MANAGER" }),
    target({ targetWins: 4, roleAtAssignment: "MANAGER" }),
    AFTER_AUGUST,
  );

  assert.equal(result.status, "SCORED");
  assert.equal(result.score, 40);
  if (result.status === "SCORED") {
    assert.equal(result.achievementRate, 1.5);
  }
});

test("Ticket 25P §51: legacy unattributed evidence still blocks a current MANAGER with LEGACY_ATTRIBUTION_INCOMPLETE, taking precedence over a valid target — Manager eligibility does not weaken this existing state ordering", () => {
  const events = [
    ...manyWins(2, { creditedUserId: "manager-a", creditedUserRoleAtEvent: "MANAGER" }),
    won({
      prospectId: "prospect-legacy",
      creditedUserId: null,
      creditedUserRoleAtEvent: null,
    }),
  ];

  const result = computeCommercialResultsResult(
    employee("manager-a", "MANAGER"),
    AUGUST,
    events,
    target({ targetWins: 4, roleAtAssignment: "MANAGER" }),
    AFTER_AUGUST,
  );

  assert.equal(result.status, "LEGACY_ATTRIBUTION_INCOMPLETE");
  assert.equal(result.score, null);
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
