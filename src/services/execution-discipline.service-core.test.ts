import assert from "node:assert/strict";
import test from "node:test";
import type { ProspectActionStatus, UserRole } from "@prisma/client";

import {
  buildEmployeeNotFoundExecutionDisciplineResult,
  buildExecutionDisciplineEvidence,
  computeExecutionDisciplineResult,
  computeExecutionDisciplineScore,
  isScorableForExecutionDiscipline,
  type ExecutionDisciplineActionRow,
  type ExecutionDisciplineEmployee,
  type ExecutionDisciplinePeriod,
} from "./execution-discipline.service-core";

const AUGUST: ExecutionDisciplinePeriod = {
  periodStart: new Date("2026-08-01T00:00:00.000Z"),
  periodEnd: new Date("2026-08-31T23:59:59.999Z"),
};
const AFTER_AUGUST = new Date("2026-09-05T00:00:00.000Z");

function employee(
  id: string,
  role: UserRole = "COMMERCIAL",
): ExecutionDisciplineEmployee {
  return { id, role };
}

function row(
  overrides: Partial<ExecutionDisciplineActionRow> = {},
): ExecutionDisciplineActionRow {
  return {
    assignedToUserId: "commercial-a",
    status: "OPEN" as ProspectActionStatus,
    dueAt: new Date("2026-08-14T10:00:00.000Z"),
    completedAt: null,
    canceledAt: null,
    ...overrides,
  };
}

function onTime(overrides: Partial<ExecutionDisciplineActionRow> = {}) {
  return row({
    status: "COMPLETED",
    dueAt: new Date("2026-08-14T10:00:00.000Z"),
    completedAt: new Date("2026-08-14T09:00:00.000Z"),
    ...overrides,
  });
}

function late(overrides: Partial<ExecutionDisciplineActionRow> = {}) {
  return row({
    status: "COMPLETED",
    dueAt: new Date("2026-08-14T10:00:00.000Z"),
    completedAt: new Date("2026-08-18T10:00:00.000Z"),
    ...overrides,
  });
}

function overdueOpen(overrides: Partial<ExecutionDisciplineActionRow> = {}) {
  return row({
    status: "OPEN",
    dueAt: new Date("2026-08-14T10:00:00.000Z"),
    ...overrides,
  });
}

function canceled(overrides: Partial<ExecutionDisciplineActionRow> = {}) {
  return row({
    status: "CANCELED",
    dueAt: new Date("2026-08-14T10:00:00.000Z"),
    canceledAt: new Date("2026-08-15T10:00:00.000Z"),
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Scoring formula (Ticket 25H §28)
// ---------------------------------------------------------------------------

test("all applicable actions completed on time scores the maximum", () => {
  const result = computeExecutionDisciplineResult(
    employee("commercial-a"),
    AUGUST,
    [onTime(), onTime(), onTime()],
    AFTER_AUGUST,
  );

  assert.equal(result.status, "SCORED");
  assert.equal(result.score, 30);
});

test("a mix of on-time and late completions scores less than the maximum", () => {
  const result = computeExecutionDisciplineResult(
    employee("commercial-a"),
    AUGUST,
    [onTime(), late()],
    AFTER_AUGUST,
  );

  assert.equal(result.status, "SCORED");
  // weighted = 1 + 0.5 = 1.5, sampleSize = 2 -> round(30 * 1.5 / 2) = 23
  assert.equal(result.score, 23);
  assert.ok(result.score! < 30);
});

test("a mix of late and open-overdue actions scores lower than late alone", () => {
  const lateOnly = computeExecutionDisciplineResult(
    employee("commercial-a"),
    AUGUST,
    [late(), late()],
    AFTER_AUGUST,
  );
  const lateAndOverdue = computeExecutionDisciplineResult(
    employee("commercial-a"),
    AUGUST,
    [late(), overdueOpen()],
    AFTER_AUGUST,
  );

  assert.equal(lateOnly.status, "SCORED");
  assert.equal(lateAndOverdue.status, "SCORED");
  assert.equal(lateOnly.score, 15);
  assert.equal(lateAndOverdue.score, 8);
  assert.ok(lateAndOverdue.score! < lateOnly.score!);
});

test("all applicable actions open-overdue scores at the minimum", () => {
  const result = computeExecutionDisciplineResult(
    employee("commercial-a"),
    AUGUST,
    [overdueOpen(), overdueOpen()],
    AFTER_AUGUST,
  );

  assert.equal(result.status, "SCORED");
  assert.equal(result.score, 0);
});

test("no applicable actions returns INSUFFICIENT_EVIDENCE, not a score of 0 or 30", () => {
  const result = computeExecutionDisciplineResult(
    employee("commercial-a"),
    AUGUST,
    [],
    AFTER_AUGUST,
  );

  assert.equal(result.status, "INSUFFICIENT_EVIDENCE");
  assert.equal(result.score, null);
  assert.equal(result.evidence.applicableActions, 0);
});

test("canceled actions are excluded from scoring credit but stay visible in evidence (Ticket 25H §9)", () => {
  const eightCanceled = Array.from({ length: 8 }, () => canceled());
  const result = computeExecutionDisciplineResult(
    employee("commercial-a"),
    AUGUST,
    [...eightCanceled, onTime(), onTime()],
    AFTER_AUGUST,
  );

  assert.equal(result.status, "SCORED");
  assert.equal(result.score, 30);
  assert.equal(result.evidence.applicableActions, 10);
  assert.equal(result.evidence.canceled, 8);
  assert.equal(result.evidence.sampleSize, 2);
});

test("an entirely canceled action set is INSUFFICIENT_EVIDENCE, not a perfect score", () => {
  const result = computeExecutionDisciplineResult(
    employee("commercial-a"),
    AUGUST,
    [canceled(), canceled()],
    AFTER_AUGUST,
  );

  assert.equal(result.status, "INSUFFICIENT_EVIDENCE");
  assert.equal(result.score, null);
  assert.equal(result.evidence.applicableActions, 2);
  assert.equal(result.evidence.canceled, 2);
  assert.equal(result.evidence.sampleSize, 0);
});

test("rounding is deterministic at a half-point boundary", () => {
  assert.equal(
    computeExecutionDisciplineScore({
      completedOnTime: 1,
      completedLate: 1,
      sampleSize: 2,
    }),
    23, // 30 * 1.5 / 2 = 22.5 -> 23
  );
  assert.equal(
    computeExecutionDisciplineScore({
      completedOnTime: 0,
      completedLate: 1,
      sampleSize: 2,
    }),
    8, // 30 * 0.5 / 2 = 7.5 -> 8
  );
});

test("a scored result's score is reproducible purely from its own evidence and policy version (Ticket 25H §20)", () => {
  const result = computeExecutionDisciplineResult(
    employee("commercial-a"),
    AUGUST,
    [onTime(), late(), overdueOpen()],
    AFTER_AUGUST,
  );

  assert.equal(result.status, "SCORED");
  assert.equal(computeExecutionDisciplineScore(result.evidence), result.score);
});

// ---------------------------------------------------------------------------
// Period boundaries (Ticket 25H §29)
// ---------------------------------------------------------------------------

test("an action due exactly at periodStart is included", () => {
  const evidence = buildExecutionDisciplineEvidence("commercial-a", AUGUST, [
    overdueOpen({ dueAt: AUGUST.periodStart }),
  ]);
  assert.equal(evidence.applicableActions, 1);
});

test("an action due exactly at periodEnd is included", () => {
  const evidence = buildExecutionDisciplineEvidence("commercial-a", AUGUST, [
    overdueOpen({ dueAt: AUGUST.periodEnd }),
  ]);
  assert.equal(evidence.applicableActions, 1);
});

test("an action due before periodStart is excluded", () => {
  const evidence = buildExecutionDisciplineEvidence("commercial-a", AUGUST, [
    overdueOpen({ dueAt: new Date(AUGUST.periodStart.getTime() - 1) }),
  ]);
  assert.equal(evidence.applicableActions, 0);
});

test("an action due after periodEnd is excluded", () => {
  const evidence = buildExecutionDisciplineEvidence("commercial-a", AUGUST, [
    overdueOpen({ dueAt: new Date(AUGUST.periodEnd.getTime() + 1) }),
  ]);
  assert.equal(evidence.applicableActions, 0);
});

test("completedAt exactly equal to dueAt counts as on time (Ticket 25H §6)", () => {
  const dueAt = new Date("2026-08-14T10:00:00.000Z");
  const evidence = buildExecutionDisciplineEvidence("commercial-a", AUGUST, [
    row({ status: "COMPLETED", dueAt, completedAt: dueAt }),
  ]);
  assert.equal(evidence.completedOnTime, 1);
  assert.equal(evidence.completedLate, 0);
});

test("completedAt one millisecond after dueAt counts as late", () => {
  const dueAt = new Date("2026-08-14T10:00:00.000Z");
  const evidence = buildExecutionDisciplineEvidence("commercial-a", AUGUST, [
    row({
      status: "COMPLETED",
      dueAt,
      completedAt: new Date(dueAt.getTime() + 1),
    }),
  ]);
  assert.equal(evidence.completedOnTime, 0);
  assert.equal(evidence.completedLate, 1);
});

test("the ticket's own worked example: still open at period end, completed after it, is open-overdue for this period, not completed-late (Ticket 25H §8)", () => {
  const evidence = buildExecutionDisciplineEvidence("commercial-a", AUGUST, [
    row({
      status: "COMPLETED", // current status, read live in September
      dueAt: new Date("2026-08-03T10:00:00.000Z"),
      completedAt: new Date("2026-09-02T10:00:00.000Z"), // after periodEnd
    }),
  ]);

  assert.equal(evidence.overdueOpen, 1);
  assert.equal(evidence.completedLate, 0);
  assert.equal(evidence.completedOnTime, 0);
});

test("a cancellation recorded after period end does not count as canceled for this period", () => {
  const evidence = buildExecutionDisciplineEvidence("commercial-a", AUGUST, [
    row({
      status: "CANCELED",
      dueAt: new Date("2026-08-03T10:00:00.000Z"),
      canceledAt: new Date("2026-09-01T00:00:00.000Z"), // after periodEnd
    }),
  ]);

  assert.equal(evidence.overdueOpen, 1);
  assert.equal(evidence.canceled, 0);
});

// ---------------------------------------------------------------------------
// Ownership (Ticket 25H §30)
// ---------------------------------------------------------------------------

test("Commercial A's actions do not enter Commercial B's evidence", () => {
  const actions = [
    onTime({ assignedToUserId: "commercial-a" }),
    overdueOpen({ assignedToUserId: "commercial-b" }),
    overdueOpen({ assignedToUserId: "commercial-b" }),
  ];

  const evidenceA = buildExecutionDisciplineEvidence(
    "commercial-a",
    AUGUST,
    actions,
  );
  const evidenceB = buildExecutionDisciplineEvidence(
    "commercial-b",
    AUGUST,
    actions,
  );

  assert.equal(evidenceA.applicableActions, 1);
  assert.equal(evidenceA.completedOnTime, 1);
  assert.equal(evidenceB.applicableActions, 2);
  assert.equal(evidenceB.overdueOpen, 2);
});

test("responsibility follows assignedToUserId alone — the row type has no creator identity for scoring to accidentally read", () => {
  // ExecutionDisciplineActionRow intentionally omits createdByUserId (see
  // the type's own comment); an action "created by A but assigned to B"
  // is simply represented as assignedToUserId: "commercial-b" here, and
  // must score entirely under B, never under A.
  const actions = [overdueOpen({ assignedToUserId: "commercial-b" })];

  const evidenceA = buildExecutionDisciplineEvidence(
    "commercial-a",
    AUGUST,
    actions,
  );
  const evidenceB = buildExecutionDisciplineEvidence(
    "commercial-b",
    AUGUST,
    actions,
  );

  assert.equal(evidenceA.applicableActions, 0);
  assert.equal(evidenceB.applicableActions, 1);
});

// ---------------------------------------------------------------------------
// Status lifecycle (Ticket 25H §31)
// ---------------------------------------------------------------------------

test("every applicable action lands in exactly one evidence bucket — none disappear", () => {
  const actions = [onTime(), late(), overdueOpen(), canceled()];
  const evidence = buildExecutionDisciplineEvidence(
    "commercial-a",
    AUGUST,
    actions,
  );

  assert.equal(evidence.applicableActions, actions.length);
  assert.equal(
    evidence.completedOnTime +
      evidence.completedLate +
      evidence.overdueOpen +
      evidence.canceled,
    evidence.applicableActions,
  );
  assert.equal(
    evidence.sampleSize,
    evidence.completedOnTime + evidence.completedLate + evidence.overdueOpen,
  );
});

// ---------------------------------------------------------------------------
// Unsupported vs. now-supported roles (Ticket 25H §2/§32; Ticket 25Q §41/§46)
// ---------------------------------------------------------------------------

for (const role of ["ADMIN", "ASSISTANT"] as const) {
  test(`${role} is refused, never silently scored with Commercial metrics`, () => {
    const result = computeExecutionDisciplineResult(
      employee("user-1", role),
      AUGUST,
      [onTime(), onTime()],
      AFTER_AUGUST,
    );

    assert.equal(result.status, "UNSUPPORTED_ROLE");
    assert.equal(result.score, null);
    assert.equal(result.evidence, null);
  });

  test(`isScorableForExecutionDiscipline(${role}) is false`, () => {
    assert.equal(isScorableForExecutionDiscipline(role), false);
  });
}

test("Ticket 25Q §41: the complete current-role subject matrix — COMMERCIAL and MANAGER are supported; ADMIN and ASSISTANT are not", () => {
  assert.equal(isScorableForExecutionDiscipline("COMMERCIAL"), true);
  assert.equal(isScorableForExecutionDiscipline("MANAGER"), true);
  assert.equal(isScorableForExecutionDiscipline("ADMIN"), false);
  assert.equal(isScorableForExecutionDiscipline("ASSISTANT"), false);
});

test("Ticket 25Q §1/§17: MANAGER is no longer refused by the orchestrator — a MANAGER with valid evidence now scores exactly like a COMMERCIAL would", () => {
  const result = computeExecutionDisciplineResult(
    employee("manager-1", "MANAGER"),
    AUGUST,
    [
      onTime({ assignedToUserId: "manager-1" }),
      onTime({ assignedToUserId: "manager-1" }),
      onTime({ assignedToUserId: "manager-1" }),
    ],
    AFTER_AUGUST,
  );

  assert.equal(result.status, "SCORED");
  assert.equal(result.score, 30);
});

test("Ticket 25Q §46: a current MANAGER with an open (not yet closed) period returns PERIOD_NOT_CLOSED, never UNSUPPORTED_ROLE — proof the role gate was actually widened, not merely bypassed for closed periods", () => {
  const midAugust = new Date("2026-08-15T00:00:00.000Z");
  const result = computeExecutionDisciplineResult(
    employee("manager-1", "MANAGER"),
    AUGUST,
    [onTime({ assignedToUserId: "manager-1" })],
    midAugust,
  );

  assert.equal(result.status, "PERIOD_NOT_CLOSED");
});

test("Ticket 25Q §45: a current MANAGER with no qualifying actions returns the same INSUFFICIENT_EVIDENCE state as a COMMERCIAL — no Manager-specific zero", () => {
  const result = computeExecutionDisciplineResult(
    employee("manager-1", "MANAGER"),
    AUGUST,
    [],
    AFTER_AUGUST,
  );

  assert.equal(result.status, "INSUFFICIENT_EVIDENCE");
  assert.equal(result.score, null);
});

test("Ticket 25Q §44: canceled actions are excluded from a MANAGER's sampleSize exactly as for a COMMERCIAL, and stay visible in evidence", () => {
  const result = computeExecutionDisciplineResult(
    employee("manager-1", "MANAGER"),
    AUGUST,
    [
      canceled({ assignedToUserId: "manager-1" }),
      onTime({ assignedToUserId: "manager-1" }),
      onTime({ assignedToUserId: "manager-1" }),
    ],
    AFTER_AUGUST,
  );

  assert.equal(result.status, "SCORED");
  assert.equal(result.score, 30);
  if (result.status === "SCORED") {
    assert.equal(result.evidence.canceled, 1);
    assert.equal(result.evidence.sampleSize, 2);
    assert.equal(result.evidence.applicableActions, 3);
  }
});

// ---------------------------------------------------------------------------
// Ticket 25Q §9/§10/§47/§48/§51: no historical role snapshot exists —
// durable assignedToUserId is the sole authority, regardless of what
// role the employee currently holds or held historically
// ---------------------------------------------------------------------------

test("Ticket 25Q §47: historical actions assigned to a user now currently MANAGER are included — there is no historical-role snapshot to filter by, so current-role eligibility alone governs", () => {
  const result = computeExecutionDisciplineResult(
    employee("amidou", "MANAGER"),
    AUGUST,
    [onTime({ assignedToUserId: "amidou" }), late({ assignedToUserId: "amidou" })],
    AFTER_AUGUST,
  );

  assert.equal(result.status, "SCORED");
  assert.equal(result.score, 23); // weighted = 1 + 0.5 = 1.5, sampleSize 2
});

test("Ticket 25Q §48: the identical durable action evidence, same employee id, but currently COMMERCIAL, is included exactly the same way — the historical role claim is never made in either direction", () => {
  const result = computeExecutionDisciplineResult(
    employee("amidou", "COMMERCIAL"),
    AUGUST,
    [onTime({ assignedToUserId: "amidou" }), late({ assignedToUserId: "amidou" })],
    AFTER_AUGUST,
  );

  assert.equal(result.status, "SCORED");
  assert.equal(result.score, 23);
});

test("Ticket 25Q §51: the same employee id with the same historical actions is scorable as COMMERCIAL, scorable as MANAGER, but UNSUPPORTED_ROLE as ASSISTANT or ADMIN — current role alone decides, since no historical role fact exists to consult instead", () => {
  const actions = [onTime({ assignedToUserId: "amidou" }), onTime({ assignedToUserId: "amidou" })];

  for (const role of ["COMMERCIAL", "MANAGER"] as const) {
    const result = computeExecutionDisciplineResult(
      employee("amidou", role),
      AUGUST,
      actions,
      AFTER_AUGUST,
    );
    assert.equal(result.status, "SCORED", `expected ${role} to be scorable`);
  }

  for (const role of ["ASSISTANT", "ADMIN"] as const) {
    const result = computeExecutionDisciplineResult(
      employee("amidou", role),
      AUGUST,
      actions,
      AFTER_AUGUST,
    );
    assert.equal(result.status, "UNSUPPORTED_ROLE", `expected ${role} to be unsupported`);
    assert.equal(result.evidence, null);
  }
});

// ---------------------------------------------------------------------------
// Period closure (Ticket 25H §8)
// ---------------------------------------------------------------------------

test("a period whose end has not yet occurred is refused rather than scored", () => {
  const now = new Date("2026-08-15T00:00:00.000Z"); // mid-August
  const result = computeExecutionDisciplineResult(
    employee("commercial-a"),
    AUGUST, // periodEnd = 2026-08-31
    [onTime()],
    now,
  );

  assert.equal(result.status, "PERIOD_NOT_CLOSED");
  assert.equal(result.score, null);
  assert.equal(result.evidence, null);
});

test("a period ending exactly at `now` is accepted as closed", () => {
  const result = computeExecutionDisciplineResult(
    employee("commercial-a"),
    AUGUST,
    [onTime()],
    AUGUST.periodEnd,
  );

  assert.equal(result.status, "SCORED");
});

// ---------------------------------------------------------------------------
// Employee resolution (service-layer fact, tested at the shared result shape)
// ---------------------------------------------------------------------------

test("an unresolved employee id produces a controlled EMPLOYEE_NOT_FOUND result, not a thrown error", () => {
  const result = buildEmployeeNotFoundExecutionDisciplineResult();

  assert.equal(result.status, "EMPLOYEE_NOT_FOUND");
  assert.equal(result.score, null);
  assert.equal(result.evidence, null);
});
