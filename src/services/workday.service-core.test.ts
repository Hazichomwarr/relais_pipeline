import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { UserRole } from "@prisma/client";

import * as workdayServiceCore from "./workday.service-core";
import {
  canConfirmWorkdayStart,
  confirmWorkdayStartForCore,
  DEFAULT_WORKDAY_EXPECTED_END_MINUTES,
  DEFAULT_WORKDAY_EXPECTED_START_MINUTES,
  endMyWorkdayCore,
  startMyWorkdayCore,
  type ConfirmWorkdayStartDependencies,
  type CreateWorkdayOutcome,
  type EndWorkdayDependencies,
  type StartWorkdayDependencies,
  type WorkdayActor,
  type WorkdayRecord,
  type WorkdaySubject,
} from "./workday.service-core";

const BUSINESS_DATE_1 = new Date("2026-09-01T00:00:00.000Z");
const BUSINESS_DATE_2 = new Date("2026-09-02T00:00:00.000Z");

function actor(overrides: Partial<WorkdayActor> = {}): WorkdayActor {
  return { id: "emp-1", role: "COMMERCIAL", active: true, ...overrides };
}

function makeWorkday(overrides: Partial<WorkdayRecord> = {}): WorkdayRecord {
  return {
    id: "workday-1",
    employeeUserId: "emp-1",
    workDate: BUSINESS_DATE_1,
    expectedStartTime: DEFAULT_WORKDAY_EXPECTED_START_MINUTES,
    expectedEndTime: DEFAULT_WORKDAY_EXPECTED_END_MINUTES,
    startedAt: new Date("2026-09-01T07:57:00.000Z"),
    confirmedAt: null,
    confirmedByUserId: null,
    endedAt: null,
    ...overrides,
  };
}

/**
 * Models the real Prisma-backed store closely enough for domain testing:
 * `create` re-checks for an existing row itself (matching the wiring
 * layer's DUPLICATE-outcome translation of a @@unique constraint hit),
 * and end/confirm are guarded conditional updates returning a count,
 * exactly like the real `updateMany` calls.
 */
function createWorkdayStore(initial: WorkdayRecord[] = []) {
  const workdays = initial.map((workday) => ({ ...workday }));
  let nextId = workdays.length + 1;

  const findExisting = async (employeeUserId: string, workDate: Date) =>
    workdays.find(
      (workday) =>
        workday.employeeUserId === employeeUserId &&
        workday.workDate.getTime() === workDate.getTime(),
    ) ?? null;

  const create = async (fields: {
    employeeUserId: string;
    workDate: Date;
    expectedStartTime: number;
    expectedEndTime: number;
    startedAt: Date;
  }): Promise<CreateWorkdayOutcome> => {
    const existing = await findExisting(fields.employeeUserId, fields.workDate);
    if (existing) {
      return { outcome: "DUPLICATE" };
    }

    const workday: WorkdayRecord = {
      id: `workday-${nextId++}`,
      employeeUserId: fields.employeeUserId,
      workDate: fields.workDate,
      expectedStartTime: fields.expectedStartTime,
      expectedEndTime: fields.expectedEndTime,
      startedAt: fields.startedAt,
      confirmedAt: null,
      confirmedByUserId: null,
      endedAt: null,
    };
    workdays.push(workday);
    return { outcome: "CREATED", workday };
  };

  const endAtomically = async (
    workdayId: string,
    employeeUserId: string,
    endedAt: Date,
  ) => {
    const workday = workdays.find(
      (item) =>
        item.id === workdayId &&
        item.employeeUserId === employeeUserId &&
        item.endedAt === null,
    );
    if (!workday) {
      return { count: 0 };
    }
    workday.endedAt = endedAt;
    return { count: 1 };
  };

  const confirmAtomically = async (
    workdayId: string,
    confirmedByUserId: string,
    confirmedAt: Date,
  ) => {
    const workday = workdays.find(
      (item) => item.id === workdayId && item.confirmedAt === null,
    );
    if (!workday) {
      return { count: 0 };
    }
    workday.confirmedAt = confirmedAt;
    workday.confirmedByUserId = confirmedByUserId;
    return { count: 1 };
  };

  return {
    workdays,
    startDependencies: { findExisting, create } satisfies StartWorkdayDependencies,
    endDependencies: {
      findCurrent: findExisting,
      endAtomically,
    } satisfies EndWorkdayDependencies,
    findWorkday: findExisting,
    confirmAtomically,
  };
}

function confirmDependencies(
  store: ReturnType<typeof createWorkdayStore>,
  subjects: Record<string, WorkdaySubject>,
): ConfirmWorkdayStartDependencies {
  return {
    findSubject: async (employeeUserId) => subjects[employeeUserId] ?? null,
    findWorkday: store.findWorkday,
    confirmAtomically: store.confirmAtomically,
  };
}

// ---------------------------------------------------------------------------
// Ticket 27C §51 — start
// ---------------------------------------------------------------------------

for (const role of ["MANAGER", "COMMERCIAL", "ASSISTANT"] as UserRole[]) {
  test(`${role} can start their own workday`, async () => {
    const store = createWorkdayStore();
    const result = await startMyWorkdayCore(
      actor({ role }),
      store.startDependencies,
      BUSINESS_DATE_1,
    );

    assert.equal(result.success, true);
  });
}

test("ADMIN cannot start a workday", async () => {
  const store = createWorkdayStore();
  const result = await startMyWorkdayCore(
    actor({ role: "ADMIN" }),
    store.startDependencies,
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "NOT_ELIGIBLE");
  }
  assert.deepEqual(store.workdays, []);
});

test("an inactive eligible-role user cannot start a workday", async () => {
  const store = createWorkdayStore();
  const result = await startMyWorkdayCore(
    actor({ active: false }),
    store.startDependencies,
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "INACTIVE_USER");
  }
  assert.deepEqual(store.workdays, []);
});

test("start derives the business date from server time, not client input", async () => {
  const store = createWorkdayStore();
  // 07:30 UTC business time, well before midnight — still resolves to the
  // same business calendar day, proving the date comes from the business-
  // timezone helper, not a naive Date() truncation quirk.
  const serverNow = new Date("2026-09-01T07:30:00.000Z");
  const result = await startMyWorkdayCore(actor(), store.startDependencies, serverNow);

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.workday.workDate.getTime(), BUSINESS_DATE_1.getTime());
  }
});

test("start snapshots the current default expected hours (480/1020)", async () => {
  const store = createWorkdayStore();
  const result = await startMyWorkdayCore(actor(), store.startDependencies, BUSINESS_DATE_1);

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.workday.expectedStartTime, 480);
    assert.equal(result.workday.expectedEndTime, 1020);
  }
});

test("07:54 start is accepted unchanged — no clamping to expected start", async () => {
  const store = createWorkdayStore();
  const now = new Date("2026-09-01T07:54:00.000Z");
  const result = await startMyWorkdayCore(actor(), store.startDependencies, now);

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.workday.startedAt.getTime(), now.getTime());
  }
});

test("08:11 start is accepted unchanged — no lateness enforcement", async () => {
  const store = createWorkdayStore();
  const now = new Date("2026-09-01T08:11:00.000Z");
  const result = await startMyWorkdayCore(actor(), store.startDependencies, now);

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.workday.startedAt.getTime(), now.getTime());
    assert.equal("late" in result.workday, false);
    assert.equal("onTime" in result.workday, false);
  }
});

test("a second start on the same business date does not rewrite startedAt — the pre-check path", async () => {
  const store = createWorkdayStore();
  const firstStart = new Date("2026-09-01T07:54:00.000Z");
  const secondAttempt = new Date("2026-09-01T09:00:00.000Z");

  const first = await startMyWorkdayCore(actor(), store.startDependencies, firstStart);
  assert.equal(first.success, true);

  const second = await startMyWorkdayCore(actor(), store.startDependencies, secondAttempt);
  assert.equal(second.success, false);
  if (!second.success) {
    assert.equal(second.code, "ALREADY_STARTED");
    if (second.code === "ALREADY_STARTED") {
      assert.equal(second.workday.startedAt.getTime(), firstStart.getTime());
    }
  }
  assert.equal(store.workdays.length, 1);
  assert.equal(store.workdays[0].startedAt.getTime(), firstStart.getTime());
});

test("a genuine concurrent double-start (unique-constraint race) preserves the first creation and never rewrites startedAt", async () => {
  const winnerStartedAt = new Date("2026-09-01T07:54:00.000Z");
  const winner = makeWorkday({ startedAt: winnerStartedAt });

  // Simulates the exact race the wiring layer's @@unique constraint
  // catches: findExisting missed it (empty at check time), but create()
  // reports DUPLICATE because another request's create won first.
  let findExistingCalls = 0;
  const dependencies: StartWorkdayDependencies = {
    findExisting: async () => {
      findExistingCalls += 1;
      return findExistingCalls === 1 ? null : winner;
    },
    create: async () => ({ outcome: "DUPLICATE" }),
  };

  const result = await startMyWorkdayCore(actor(), dependencies, new Date("2026-09-01T09:00:00.000Z"));

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "ALREADY_STARTED");
    if (result.code === "ALREADY_STARTED") {
      assert.equal(result.workday.startedAt.getTime(), winnerStartedAt.getTime());
    }
  }
});

test("a new business date allows a new Workday for the same employee", async () => {
  const store = createWorkdayStore();
  const day1 = await startMyWorkdayCore(actor(), store.startDependencies, BUSINESS_DATE_1);
  const day2 = await startMyWorkdayCore(actor(), store.startDependencies, BUSINESS_DATE_2);

  assert.equal(day1.success, true);
  assert.equal(day2.success, true);
  assert.equal(store.workdays.length, 2);
});

// ---------------------------------------------------------------------------
// Ticket 27C §52 — end
// ---------------------------------------------------------------------------

test("an eligible employee can end their own started workday", async () => {
  const store = createWorkdayStore([makeWorkday()]);
  const result = await endMyWorkdayCore(actor(), store.endDependencies, new Date("2026-09-01T17:10:00.000Z"));

  assert.equal(result.success, true);
  assert.equal(store.workdays[0].endedAt?.toISOString(), "2026-09-01T17:10:00.000Z");
});

test("cannot end without a Workday for today", async () => {
  const store = createWorkdayStore();
  const result = await endMyWorkdayCore(actor(), store.endDependencies, BUSINESS_DATE_1);

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "NOT_STARTED");
  }
});

test("cannot end another person's Workday — findCurrent is always scoped to the acting employee", async () => {
  const store = createWorkdayStore([makeWorkday({ employeeUserId: "emp-1" })]);
  const result = await endMyWorkdayCore(
    actor({ id: "emp-2" }),
    store.endDependencies,
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "NOT_STARTED");
  }
  assert.equal(store.workdays[0].endedAt, null);
});

test("endedAt comes from the server clock passed to the core, never from the stored expected hours", async () => {
  const store = createWorkdayStore([makeWorkday()]);
  const serverNow = new Date("2026-09-01T17:21:00.000Z");
  const result = await endMyWorkdayCore(actor(), store.endDependencies, serverNow);

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.workday.endedAt?.getTime(), serverNow.getTime());
  }
});

test("first end wins; double end does not rewrite the original endedAt", async () => {
  const store = createWorkdayStore([makeWorkday()]);
  const firstEnd = new Date("2026-09-01T17:10:00.000Z");
  const secondAttempt = new Date("2026-09-01T18:00:00.000Z");

  const first = await endMyWorkdayCore(actor(), store.endDependencies, firstEnd);
  assert.equal(first.success, true);

  const second = await endMyWorkdayCore(actor(), store.endDependencies, secondAttempt);
  assert.equal(second.success, false);
  if (!second.success) {
    assert.equal(second.code, "ALREADY_ENDED");
  }
  assert.equal(store.workdays[0].endedAt?.getTime(), firstEnd.getTime());
});

test("a concurrently-lost end race (guarded update count 0) also preserves the winner's endedAt", async () => {
  const dependencies: EndWorkdayDependencies = {
    findCurrent: async () => makeWorkday({ endedAt: null }),
    endAtomically: async () => ({ count: 0 }),
  };

  const result = await endMyWorkdayCore(actor(), dependencies, new Date("2026-09-01T17:11:00.000Z"));

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "ALREADY_ENDED");
  }
});

test("can end while unconfirmed", async () => {
  const store = createWorkdayStore([makeWorkday({ confirmedAt: null })]);
  const result = await endMyWorkdayCore(actor(), store.endDependencies, BUSINESS_DATE_1);
  assert.equal(result.success, true);
});

test("can end while already confirmed", async () => {
  const store = createWorkdayStore([
    makeWorkday({ confirmedAt: new Date("2026-09-01T08:03:00.000Z"), confirmedByUserId: "mgr-1" }),
  ]);
  const result = await endMyWorkdayCore(actor(), store.endDependencies, BUSINESS_DATE_1);
  assert.equal(result.success, true);
});

test("no Admin/Manager end-override function exists on the core module", () => {
  const exported = workdayServiceCore as Record<string, unknown>;
  assert.equal(typeof exported.endWorkdayFor, "undefined");
  assert.equal(typeof exported.adminCloseWorkday, "undefined");
  assert.equal(typeof exported.managerEndWorkday, "undefined");
});

// ---------------------------------------------------------------------------
// Ticket 27C §53 — the full confirmation matrix
// ---------------------------------------------------------------------------

const ALLOWED_CONFIRMATIONS: Array<[UserRole, UserRole]> = [
  ["ADMIN", "MANAGER"],
  ["ADMIN", "COMMERCIAL"],
  ["ADMIN", "ASSISTANT"],
  ["MANAGER", "COMMERCIAL"],
  ["MANAGER", "ASSISTANT"],
];

const DENIED_CONFIRMATIONS: Array<[UserRole, UserRole]> = [
  ["MANAGER", "MANAGER"],
  ["MANAGER", "ADMIN"],
  ["COMMERCIAL", "COMMERCIAL"],
  ["COMMERCIAL", "MANAGER"],
  ["COMMERCIAL", "ASSISTANT"],
  ["COMMERCIAL", "ADMIN"],
  ["ASSISTANT", "COMMERCIAL"],
  ["ASSISTANT", "MANAGER"],
  ["ASSISTANT", "ADMIN"],
  ["ASSISTANT", "ASSISTANT"],
];

for (const [actorRole, subjectRole] of ALLOWED_CONFIRMATIONS) {
  test(`canConfirmWorkdayStart: ${actorRole} -> ${subjectRole} is allowed`, () => {
    assert.equal(canConfirmWorkdayStart(actorRole, subjectRole, false), true);
  });
}

for (const [actorRole, subjectRole] of DENIED_CONFIRMATIONS) {
  test(`canConfirmWorkdayStart: ${actorRole} -> ${subjectRole} is denied`, () => {
    assert.equal(canConfirmWorkdayStart(actorRole, subjectRole, false), false);
  });
}

test("canConfirmWorkdayStart: MANAGER cannot confirm self", () => {
  assert.equal(canConfirmWorkdayStart("MANAGER", "MANAGER", true), false);
});

test("canConfirmWorkdayStart: self-confirmation is denied for every actor role", () => {
  for (const role of ["ADMIN", "MANAGER", "COMMERCIAL", "ASSISTANT"] as UserRole[]) {
    assert.equal(canConfirmWorkdayStart(role, role, true), false);
  }
});

// ---------------------------------------------------------------------------
// Ticket 27C §54 — confirmation lifecycle
// ---------------------------------------------------------------------------

test("cannot confirm before start — no Workday exists yet", async () => {
  const store = createWorkdayStore();
  const subjects = { "emp-1": { id: "emp-1", role: "COMMERCIAL" as UserRole, active: true } };

  const result = await confirmWorkdayStartForCore(
    actor({ id: "mgr-1", role: "MANAGER" }),
    { employeeUserId: "emp-1", workDate: BUSINESS_DATE_1 },
    confirmDependencies(store, subjects),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "WORKDAY_NOT_FOUND");
  }
});

test("confirmation preserves startedAt exactly — there is no code path that can rewrite it", async () => {
  const startedAt = new Date("2026-09-01T07:57:00.000Z");
  const store = createWorkdayStore([makeWorkday({ startedAt })]);
  const subjects = { "emp-1": { id: "emp-1", role: "COMMERCIAL" as UserRole, active: true } };
  const confirmedAt = new Date("2026-09-01T08:03:00.000Z");

  const result = await confirmWorkdayStartForCore(
    actor({ id: "mgr-1", role: "MANAGER" }),
    { employeeUserId: "emp-1", workDate: BUSINESS_DATE_1 },
    confirmDependencies(store, subjects),
    confirmedAt,
  );

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.workday.startedAt.getTime(), startedAt.getTime());
    assert.equal(result.workday.confirmedAt?.getTime(), confirmedAt.getTime());
  }
  assert.equal(store.workdays[0].startedAt.getTime(), startedAt.getTime());
});

test("confirmedAt comes from the server clock and confirmedByUserId from the acting actor", async () => {
  const store = createWorkdayStore([makeWorkday()]);
  const subjects = { "emp-1": { id: "emp-1", role: "COMMERCIAL" as UserRole, active: true } };
  const now = new Date("2026-09-01T08:03:00.000Z");

  const result = await confirmWorkdayStartForCore(
    actor({ id: "mgr-7", role: "MANAGER" }),
    { employeeUserId: "emp-1", workDate: BUSINESS_DATE_1 },
    confirmDependencies(store, subjects),
    now,
  );

  assert.equal(result.success, true);
  assert.equal(store.workdays[0].confirmedAt?.getTime(), now.getTime());
  assert.equal(store.workdays[0].confirmedByUserId, "mgr-7");
});

test("double confirmation preserves the first confirmer and timestamp", async () => {
  const store = createWorkdayStore([makeWorkday()]);
  const subjects = { "emp-1": { id: "emp-1", role: "COMMERCIAL" as UserRole, active: true } };
  const firstConfirm = new Date("2026-09-01T08:03:00.000Z");
  const secondConfirm = new Date("2026-09-01T08:10:00.000Z");

  const first = await confirmWorkdayStartForCore(
    actor({ id: "mgr-1", role: "MANAGER" }),
    { employeeUserId: "emp-1", workDate: BUSINESS_DATE_1 },
    confirmDependencies(store, subjects),
    firstConfirm,
  );
  assert.equal(first.success, true);

  const second = await confirmWorkdayStartForCore(
    actor({ id: "admin-1", role: "ADMIN" }),
    { employeeUserId: "emp-1", workDate: BUSINESS_DATE_1 },
    confirmDependencies(store, subjects),
    secondConfirm,
  );

  assert.equal(second.success, false);
  if (!second.success) {
    assert.equal(second.code, "ALREADY_CONFIRMED");
  }
  assert.equal(store.workdays[0].confirmedAt?.getTime(), firstConfirm.getTime());
  assert.equal(store.workdays[0].confirmedByUserId, "mgr-1");
});

test("Admin and Manager confirming simultaneously: first-wins at the guarded-write layer, the loser never overwrites", async () => {
  const winnerConfirmedAt = new Date("2026-09-01T08:03:00.000Z");
  const dependencies: ConfirmWorkdayStartDependencies = {
    findSubject: async () => ({ id: "emp-1", role: "COMMERCIAL", active: true }),
    findWorkday: async () =>
      makeWorkday({ confirmedAt: null, confirmedByUserId: null }),
    // Simulates the loser's guarded updateMany losing the race.
    confirmAtomically: async () => ({ count: 0 }),
  };

  const result = await confirmWorkdayStartForCore(
    actor({ id: "admin-1", role: "ADMIN" }),
    { employeeUserId: "emp-1", workDate: BUSINESS_DATE_1 },
    dependencies,
    winnerConfirmedAt,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "ALREADY_CONFIRMED");
  }
});

test("same-business-day confirmation after End is allowed", async () => {
  const store = createWorkdayStore([
    makeWorkday({ endedAt: new Date("2026-09-01T17:00:00.000Z") }),
  ]);
  const subjects = { "emp-1": { id: "emp-1", role: "COMMERCIAL" as UserRole, active: true } };
  const confirmedAt = new Date("2026-09-01T17:15:00.000Z");

  const result = await confirmWorkdayStartForCore(
    actor({ id: "mgr-1", role: "MANAGER" }),
    { employeeUserId: "emp-1", workDate: BUSINESS_DATE_1 },
    confirmDependencies(store, subjects),
    confirmedAt,
  );

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.workday.confirmedAt?.getTime(), confirmedAt.getTime());
  }
});

test("confirming a Workday for a business date earlier than today is denied — no retrospective confirmation", async () => {
  const store = createWorkdayStore([makeWorkday({ workDate: BUSINESS_DATE_1 })]);
  const subjects = { "emp-1": { id: "emp-1", role: "COMMERCIAL" as UserRole, active: true } };
  const today = BUSINESS_DATE_2; // "today" is Sept 2; the target Workday is Sept 1

  const result = await confirmWorkdayStartForCore(
    actor({ id: "mgr-1", role: "MANAGER" }),
    { employeeUserId: "emp-1", workDate: BUSINESS_DATE_1 },
    confirmDependencies(store, subjects),
    today,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "CONFIRMATION_DATE_NOT_ALLOWED");
  }
});

test("confirming a future business date is denied", async () => {
  const store = createWorkdayStore();
  const subjects = { "emp-1": { id: "emp-1", role: "COMMERCIAL" as UserRole, active: true } };
  const today = BUSINESS_DATE_1;

  const result = await confirmWorkdayStartForCore(
    actor({ id: "mgr-1", role: "MANAGER" }),
    { employeeUserId: "emp-1", workDate: BUSINESS_DATE_2 }, // tomorrow
    confirmDependencies(store, subjects),
    today,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "CONFIRMATION_DATE_NOT_ALLOWED");
  }
});

test("an unconfirmed ended day remains valid — end never requires confirmation, and confirmation is simply skipped, not treated as absence", async () => {
  const store = createWorkdayStore([
    makeWorkday({
      startedAt: new Date("2026-09-01T08:01:00.000Z"),
      confirmedAt: null,
      endedAt: new Date("2026-09-01T17:12:00.000Z"),
    }),
  ]);

  assert.equal(store.workdays[0].confirmedAt, null);
  assert.notEqual(store.workdays[0].endedAt, null);
});

test("an inactive subject cannot receive a new confirmation, without mutating the existing Workday", async () => {
  const store = createWorkdayStore([makeWorkday()]);
  const subjects = { "emp-1": { id: "emp-1", role: "COMMERCIAL" as UserRole, active: false } };

  const result = await confirmWorkdayStartForCore(
    actor({ id: "mgr-1", role: "MANAGER" }),
    { employeeUserId: "emp-1", workDate: BUSINESS_DATE_1 },
    confirmDependencies(store, subjects),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "SUBJECT_NOT_FOUND");
  }
  assert.equal(store.workdays[0].confirmedAt, null);
});

test("an actor whose own account is inactive cannot confirm anyone", async () => {
  const store = createWorkdayStore([makeWorkday()]);
  const subjects = { "emp-1": { id: "emp-1", role: "COMMERCIAL" as UserRole, active: true } };

  const result = await confirmWorkdayStartForCore(
    actor({ id: "mgr-1", role: "MANAGER", active: false }),
    { employeeUserId: "emp-1", workDate: BUSINESS_DATE_1 },
    confirmDependencies(store, subjects),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "INACTIVE_USER");
  }
});

// ---------------------------------------------------------------------------
// Ticket 27C §55 — role-transition historical regression
// ---------------------------------------------------------------------------

test("a Workday started while COMMERCIAL remains fully valid, unmutated history when ended after the same employee becomes MANAGER", async () => {
  const startedAt = new Date("2026-09-01T07:57:00.000Z");
  const store = createWorkdayStore([makeWorkday({ startedAt })]);

  // Same person, but their role changed between start and end — still an
  // eligible role, so ending must succeed, and every historical field
  // (startedAt, expected hours, workDate) must come back untouched.
  const result = await endMyWorkdayCore(
    actor({ role: "MANAGER" }),
    store.endDependencies,
    new Date("2026-09-01T17:00:00.000Z"),
  );

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.workday.startedAt.getTime(), startedAt.getTime());
    assert.equal(result.workday.expectedStartTime, DEFAULT_WORKDAY_EXPECTED_START_MINUTES);
    assert.equal(result.workday.expectedEndTime, DEFAULT_WORKDAY_EXPECTED_END_MINUTES);
    assert.equal(result.workday.workDate.getTime(), BUSINESS_DATE_1.getTime());
  }
});

test("eligibility gates the new action, not the historical row's existence — an ADMIN (now ineligible) cannot end an old Workday, but the row is left completely unchanged", async () => {
  const startedAt = new Date("2026-09-01T07:57:00.000Z");
  const store = createWorkdayStore([makeWorkday({ startedAt })]);

  const result = await endMyWorkdayCore(
    actor({ role: "ADMIN" }),
    store.endDependencies,
    new Date("2026-09-01T17:00:00.000Z"),
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "NOT_ELIGIBLE");
  }
  // The row itself was never touched by the rejected attempt.
  assert.equal(store.workdays[0].startedAt.getTime(), startedAt.getTime());
  assert.equal(store.workdays[0].endedAt, null);
});

// ---------------------------------------------------------------------------
// Ticket 27C §56 — non-interference regression
// ---------------------------------------------------------------------------

function importLines(source: string): string {
  return source
    .split("\n")
    .filter((line) => line.trim().startsWith("import "))
    .join("\n");
}

test("Workday lifecycle code imports nothing from Performance or OrganizationMembership — design-precedent comments citing those files by name are fine, only actual imports are checked", () => {
  const core = importLines(readFileSync("src/services/workday.service-core.ts", "utf8"));
  const wiring = importLines(readFileSync("src/services/workday.service.ts", "utf8"));

  const forbiddenImportPatterns = [
    /organization-bootstrap/,
    /organization["']/,
    /commercial-results/,
    /execution-discipline/,
    /role-responsibility-assessment/,
    /professional-contribution/,
    /performance-summary/,
    /commercial-performance-target/,
  ];

  for (const pattern of forbiddenImportPatterns) {
    assert.doesNotMatch(core, pattern, `workday.service-core.ts must not import ${pattern}`);
    assert.doesNotMatch(wiring, pattern, `workday.service.ts must not import ${pattern}`);
  }
});

test("Workday core imports no Prisma runtime — only a type-only UserRole import is allowed, matching every other *.service-core.ts in this codebase", () => {
  const core = readFileSync("src/services/workday.service-core.ts", "utf8");
  assert.doesNotMatch(core, /import \{ prisma \}/);
  assert.doesNotMatch(core, /PrismaClient/);
  assert.doesNotMatch(core, /"server-only"/);
  assert.match(core, /import type \{ UserRole \} from "@prisma\/client"/);
});
