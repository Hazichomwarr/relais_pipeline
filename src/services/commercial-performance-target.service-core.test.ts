import assert from "node:assert/strict";
import test from "node:test";
import type { UserRole } from "@prisma/client";

import {
  canManageCommercialPerformanceTargets,
  createCommercialPerformanceTargetCore,
  deleteCommercialPerformanceTargetCore,
  getCommercialPerformanceTargetCore,
  isCommercialPerformanceTargetPeriodLocked,
  isEligibleForCommercialPerformanceTarget,
  resolveCommercialPerformanceTargetPeriod,
  updateCommercialPerformanceTargetCore,
  type CommercialPerformanceTargetActor,
  type CommercialPerformanceTargetEmployeeRecord,
  type CommercialPerformanceTargetRow,
  type CreateCommercialPerformanceTargetFields,
  type CreateCommercialPerformanceTargetInput,
} from "./commercial-performance-target.service-core";

function actor(id: string, role: UserRole): CommercialPerformanceTargetActor {
  return { id, role };
}

function employee(
  overrides: Partial<CommercialPerformanceTargetEmployeeRecord> = {},
): CommercialPerformanceTargetEmployeeRecord {
  return { id: "commercial-a", role: "COMMERCIAL", active: true, ...overrides };
}

function baseInput(
  overrides: Partial<CreateCommercialPerformanceTargetInput> = {},
): CreateCommercialPerformanceTargetInput {
  return {
    userId: "commercial-a",
    month: { year: 2026, month: 9 }, // September — an upcoming month
    targetWins: 4,
    ...overrides,
  };
}

const NOW_MID_AUGUST = new Date("2026-08-15T00:00:00.000Z");

// ---------------------------------------------------------------------------
// resolveCommercialPerformanceTargetPeriod
// ---------------------------------------------------------------------------

test("resolveCommercialPerformanceTargetPeriod resolves a calendar month, both bounds inclusive", () => {
  const period = resolveCommercialPerformanceTargetPeriod({
    year: 2026,
    month: 9,
  });

  assert.deepEqual(period.periodStart, new Date("2026-09-01T00:00:00.000Z"));
  assert.deepEqual(period.periodEnd, new Date("2026-09-30T23:59:59.999Z"));
});

test("resolveCommercialPerformanceTargetPeriod correctly rolls over a December target into the next year", () => {
  const period = resolveCommercialPerformanceTargetPeriod({
    year: 2026,
    month: 12,
  });

  assert.deepEqual(period.periodStart, new Date("2026-12-01T00:00:00.000Z"));
  assert.deepEqual(period.periodEnd, new Date("2026-12-31T23:59:59.999Z"));
});

// ---------------------------------------------------------------------------
// isCommercialPerformanceTargetPeriodLocked
// ---------------------------------------------------------------------------

test("a period is not locked before its start", () => {
  assert.equal(
    isCommercialPerformanceTargetPeriodLocked(
      new Date("2026-09-01T00:00:00.000Z"),
      new Date("2026-08-31T23:59:59.999Z"),
    ),
    false,
  );
});

test("a period is locked exactly at its start instant — no grace period", () => {
  const periodStart = new Date("2026-09-01T00:00:00.000Z");
  assert.equal(
    isCommercialPerformanceTargetPeriodLocked(periodStart, periodStart),
    true,
  );
});

test("a period is locked after its start", () => {
  assert.equal(
    isCommercialPerformanceTargetPeriodLocked(
      new Date("2026-09-01T00:00:00.000Z"),
      new Date("2026-09-02T00:00:00.000Z"),
    ),
    true,
  );
});

// ---------------------------------------------------------------------------
// §50/§51: role gates
// ---------------------------------------------------------------------------

for (const role of ["ADMIN", "MANAGER"] as const) {
  test(`§50: ${role} can manage commercial performance targets`, () => {
    assert.equal(canManageCommercialPerformanceTargets(actor("actor-1", role)), true);
  });
}

test("§50/§9: COMMERCIAL cannot manage commercial performance targets — no self-assignment", () => {
  assert.equal(
    canManageCommercialPerformanceTargets(actor("actor-1", "COMMERCIAL")),
    false,
  );
});

test("Ticket 25P §11/§46: COMMERCIAL and MANAGER are both eligible to have a target", () => {
  assert.equal(isEligibleForCommercialPerformanceTarget("COMMERCIAL"), true);
  assert.equal(isEligibleForCommercialPerformanceTarget("MANAGER"), true);
});

for (const role of ["ADMIN", "ASSISTANT"] as const) {
  test(`§51: ${role} is not eligible to have a Commercial performance target`, () => {
    assert.equal(isEligibleForCommercialPerformanceTarget(role), false);
  });
}

// ---------------------------------------------------------------------------
// Create — dependency helpers
// ---------------------------------------------------------------------------

function createDeps(overrides: {
  findEmployee?: () => Promise<CommercialPerformanceTargetEmployeeRecord | null>;
  findExisting?: () => Promise<{ id: string } | null>;
  create?: (
    fields: CreateCommercialPerformanceTargetFields,
  ) => Promise<{ id: string }>;
} = {}) {
  return {
    findEmployee: overrides.findEmployee ?? (async () => employee()),
    findExisting: overrides.findExisting ?? (async () => null),
    create: overrides.create ?? (async () => ({ id: "target-1" })),
  };
}

test("§50: an ADMIN can create an upcoming Commercial target", async () => {
  const result = await createCommercialPerformanceTargetCore(
    actor("admin-1", "ADMIN"),
    baseInput(),
    createDeps(),
    NOW_MID_AUGUST,
  );

  assert.deepEqual(result, { success: true, targetId: "target-1" });
});

test("§50: a MANAGER can create an upcoming Commercial target (org-wide V1 authority)", async () => {
  const result = await createCommercialPerformanceTargetCore(
    actor("manager-1", "MANAGER"),
    baseInput(),
    createDeps(),
    NOW_MID_AUGUST,
  );

  assert.equal(result.success, true);
});

test("§50: a COMMERCIAL cannot create a target, even for themselves", async () => {
  const result = await createCommercialPerformanceTargetCore(
    actor("commercial-a", "COMMERCIAL"),
    baseInput({ userId: "commercial-a", targetWins: 0 }),
    createDeps(),
    NOW_MID_AUGUST,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "ACCESS_DENIED");
});

// ---------------------------------------------------------------------------
// §51/Ticket 25P §36/§52: employee eligibility
// ---------------------------------------------------------------------------

test("Ticket 25P §36/§52: a target for a MANAGER employee now succeeds — this was EMPLOYEE_NOT_ELIGIBLE before 25P", async () => {
  const result = await createCommercialPerformanceTargetCore(
    actor("admin-1", "ADMIN"),
    baseInput(),
    createDeps({ findEmployee: async () => employee({ role: "MANAGER" }) }),
    NOW_MID_AUGUST,
  );

  assert.equal(result.success, true);
});

test("§51: a target for an ADMIN employee is rejected", async () => {
  const result = await createCommercialPerformanceTargetCore(
    actor("admin-1", "ADMIN"),
    baseInput(),
    createDeps({ findEmployee: async () => employee({ role: "ADMIN" }) }),
    NOW_MID_AUGUST,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "EMPLOYEE_NOT_ELIGIBLE");
});

test("Ticket 25P §36/§52: a target for an ASSISTANT employee is rejected", async () => {
  const result = await createCommercialPerformanceTargetCore(
    actor("admin-1", "ADMIN"),
    baseInput(),
    createDeps({ findEmployee: async () => employee({ role: "ASSISTANT" }) }),
    NOW_MID_AUGUST,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "EMPLOYEE_NOT_ELIGIBLE");
});

test("an unknown or inactive employee is rejected", async () => {
  const missing = await createCommercialPerformanceTargetCore(
    actor("admin-1", "ADMIN"),
    baseInput(),
    createDeps({ findEmployee: async () => null }),
    NOW_MID_AUGUST,
  );
  const inactive = await createCommercialPerformanceTargetCore(
    actor("admin-1", "ADMIN"),
    baseInput(),
    createDeps({ findEmployee: async () => employee({ active: false }) }),
    NOW_MID_AUGUST,
  );

  assert.equal(missing.success, false);
  if (!missing.success) assert.equal(missing.code, "EMPLOYEE_NOT_FOUND");
  assert.equal(inactive.success, false);
  if (!inactive.success) assert.equal(inactive.code, "EMPLOYEE_NOT_FOUND");
});

// ---------------------------------------------------------------------------
// §52: target value validation
// ---------------------------------------------------------------------------

test("§52: targetWins = 1 is valid", async () => {
  const result = await createCommercialPerformanceTargetCore(
    actor("admin-1", "ADMIN"),
    baseInput({ targetWins: 1 }),
    createDeps(),
    NOW_MID_AUGUST,
  );
  assert.equal(result.success, true);
});

test("§52: targetWins = 4 is valid", async () => {
  const result = await createCommercialPerformanceTargetCore(
    actor("admin-1", "ADMIN"),
    baseInput({ targetWins: 4 }),
    createDeps(),
    NOW_MID_AUGUST,
  );
  assert.equal(result.success, true);
});

for (const invalid of [0, -1, -4, 1.5]) {
  test(`§52: targetWins = ${invalid} is rejected`, async () => {
    const result = await createCommercialPerformanceTargetCore(
      actor("admin-1", "ADMIN"),
      baseInput({ targetWins: invalid }),
      createDeps(),
      NOW_MID_AUGUST,
    );
    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.code, "INVALID_TARGET_VALUE");
  });
}

// ---------------------------------------------------------------------------
// §53: duplicate period (service-level rejection; DB unique constraint is
// verified separately by the migration content test)
// ---------------------------------------------------------------------------

test("§53: a second target for the same employee and period is rejected", async () => {
  const result = await createCommercialPerformanceTargetCore(
    actor("admin-1", "ADMIN"),
    baseInput(),
    createDeps({ findExisting: async () => ({ id: "existing-target" }) }),
    NOW_MID_AUGUST,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "DUPLICATE_PERIOD");
});

// ---------------------------------------------------------------------------
// §54/§55: retroactive vs. future creation
// ---------------------------------------------------------------------------

test("§54: creation is rejected once the target period has already started", async () => {
  const result = await createCommercialPerformanceTargetCore(
    actor("admin-1", "ADMIN"),
    baseInput({ month: { year: 2026, month: 8 } }), // August, and "now" is mid-August
    createDeps(),
    NOW_MID_AUGUST,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "PERIOD_ALREADY_STARTED");
});

test("§54: creation is rejected exactly at the periodStart boundary", async () => {
  const result = await createCommercialPerformanceTargetCore(
    actor("admin-1", "ADMIN"),
    baseInput({ month: { year: 2026, month: 9 } }),
    createDeps(),
    new Date("2026-09-01T00:00:00.000Z"), // now === periodStart
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "PERIOD_ALREADY_STARTED");
});

test("§55: creation succeeds for a genuinely upcoming period", async () => {
  const result = await createCommercialPerformanceTargetCore(
    actor("admin-1", "ADMIN"),
    baseInput({ month: { year: 2026, month: 9 } }),
    createDeps(),
    NOW_MID_AUGUST,
  );

  assert.equal(result.success, true);
});

// ---------------------------------------------------------------------------
// §56: editing
// ---------------------------------------------------------------------------

function targetRow(
  overrides: Partial<CommercialPerformanceTargetRow> = {},
): CommercialPerformanceTargetRow {
  return {
    id: "target-1",
    userId: "commercial-a",
    periodStart: new Date("2026-09-01T00:00:00.000Z"),
    periodEnd: new Date("2026-09-30T23:59:59.999Z"),
    targetWins: 4,
    roleAtAssignment: "COMMERCIAL",
    ...overrides,
  };
}

test("§56: an upcoming target's value can be edited before its period starts", async () => {
  let updatedTo: number | undefined;
  const result = await updateCommercialPerformanceTargetCore(
    actor("admin-1", "ADMIN"),
    "target-1",
    5,
    {
      findById: async () => targetRow(),
      update: async (id, wins) => {
        assert.equal(id, "target-1");
        updatedTo = wins;
      },
    },
    NOW_MID_AUGUST,
  );

  assert.equal(result.success, true);
  assert.equal(updatedTo, 5);
});

test("§56: a locked target cannot be edited", async () => {
  const result = await updateCommercialPerformanceTargetCore(
    actor("admin-1", "ADMIN"),
    "target-1",
    5,
    {
      findById: async () =>
        targetRow({ periodStart: new Date("2026-08-01T00:00:00.000Z") }),
      update: async () => {
        assert.fail("update must not be called on a locked target");
      },
    },
    NOW_MID_AUGUST,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "TARGET_LOCKED");
});

test("editing enforces the same actor role gate and value validation as creation", async () => {
  const deniedActor = await updateCommercialPerformanceTargetCore(
    actor("commercial-a", "COMMERCIAL"),
    "target-1",
    5,
    { findById: async () => targetRow(), update: async () => {} },
    NOW_MID_AUGUST,
  );
  const invalidValue = await updateCommercialPerformanceTargetCore(
    actor("admin-1", "ADMIN"),
    "target-1",
    0,
    { findById: async () => targetRow(), update: async () => {} },
    NOW_MID_AUGUST,
  );

  assert.equal(deniedActor.success, false);
  if (!deniedActor.success) assert.equal(deniedActor.code, "ACCESS_DENIED");
  assert.equal(invalidValue.success, false);
  if (!invalidValue.success) assert.equal(invalidValue.code, "INVALID_TARGET_VALUE");
});

// ---------------------------------------------------------------------------
// §57: deletion
// ---------------------------------------------------------------------------

test("§57: an upcoming target can be deleted before its period starts", async () => {
  let deletedId: string | undefined;
  const result = await deleteCommercialPerformanceTargetCore(
    actor("admin-1", "ADMIN"),
    "target-1",
    {
      findById: async () => ({
        id: "target-1",
        periodStart: new Date("2026-09-01T00:00:00.000Z"),
      }),
      delete: async (id) => {
        deletedId = id;
      },
    },
    NOW_MID_AUGUST,
  );

  assert.equal(result.success, true);
  assert.equal(deletedId, "target-1");
});

test("§57: a locked target cannot be deleted", async () => {
  const result = await deleteCommercialPerformanceTargetCore(
    actor("admin-1", "ADMIN"),
    "target-1",
    {
      findById: async () => ({
        id: "target-1",
        periodStart: new Date("2026-08-01T00:00:00.000Z"),
      }),
      delete: async () => {
        assert.fail("delete must not be called on a locked target");
      },
    },
    NOW_MID_AUGUST,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "TARGET_LOCKED");
});

// ---------------------------------------------------------------------------
// §58/§59: role changes after creation never rewrite the snapshot
// ---------------------------------------------------------------------------

test("§58: roleAtAssignment is captured from the employee's role at creation time — later re-reading the employee's (now different) role cannot affect what was already created", async () => {
  let capturedRole: UserRole | undefined;

  await createCommercialPerformanceTargetCore(
    actor("admin-1", "ADMIN"),
    baseInput(),
    createDeps({
      findEmployee: async () => employee({ role: "COMMERCIAL" }),
      create: async (fields: CreateCommercialPerformanceTargetFields) => {
        capturedRole = fields.roleAtAssignment;
        return { id: "target-1" };
      },
    }),
    NOW_MID_AUGUST,
  );

  assert.equal(capturedRole, "COMMERCIAL");
  // The employee being promoted afterward has no code path back into an
  // already-created row: update/delete never touch roleAtAssignment.
});

test("Ticket 25P §13/§53: a target created for a MANAGER employee snapshots roleAtAssignment = MANAGER — no normalization to COMMERCIAL", async () => {
  let capturedRole: UserRole | undefined;

  await createCommercialPerformanceTargetCore(
    actor("admin-1", "ADMIN"),
    baseInput(),
    createDeps({
      findEmployee: async () => employee({ role: "MANAGER" }),
      create: async (fields: CreateCommercialPerformanceTargetFields) => {
        capturedRole = fields.roleAtAssignment;
        return { id: "target-1" };
      },
    }),
    NOW_MID_AUGUST,
  );

  assert.equal(capturedRole, "MANAGER");
});

test("§59: createdByRoleAtEvent is captured from the actor at creation time, independent of what that actor's role becomes later", async () => {
  let capturedCreatorRole: UserRole | undefined;

  await createCommercialPerformanceTargetCore(
    actor("manager-1", "MANAGER"),
    baseInput(),
    createDeps({
      create: async (fields: CreateCommercialPerformanceTargetFields) => {
        capturedCreatorRole = fields.createdByRoleAtEvent;
        return { id: "target-1" };
      },
    }),
    NOW_MID_AUGUST,
  );

  assert.equal(capturedCreatorRole, "MANAGER");
  // updateCommercialPerformanceTargetCore/deleteCommercialPerformanceTargetCore
  // take no createdByRoleAtEvent parameter at all — structurally incapable
  // of rewriting it, regardless of the creator's current role.
});

// ---------------------------------------------------------------------------
// §60/§61: exact lookup, no fallback
// ---------------------------------------------------------------------------

test("§60: requesting August never returns a September target", async () => {
  const august = { periodStart: new Date("2026-08-01T00:00:00.000Z"), periodEnd: new Date("2026-08-31T23:59:59.999Z") };
  const september = targetRow({
    id: "september-target",
    periodStart: new Date("2026-09-01T00:00:00.000Z"),
    periodEnd: new Date("2026-09-30T23:59:59.999Z"),
  });

  const result = await getCommercialPerformanceTargetCore(
    "commercial-a",
    august,
    {
      findExact: async (userId, periodStart, periodEnd) => {
        // Simulates an exact-key lookup: only returns a row when the
        // requested period matches exactly, never "the latest" target.
        if (
          periodStart.getTime() === september.periodStart.getTime() &&
          periodEnd.getTime() === september.periodEnd.getTime()
        ) {
          return september;
        }
        return null;
      },
    },
  );

  assert.equal(result, null);
});

test("§61: a period with no target returns an explicit null, not a fabricated default", async () => {
  const result = await getCommercialPerformanceTargetCore(
    "commercial-a",
    { periodStart: new Date("2026-09-01T00:00:00.000Z"), periodEnd: new Date("2026-09-30T23:59:59.999Z") },
    { findExact: async () => null },
  );

  assert.equal(result, null);
});
