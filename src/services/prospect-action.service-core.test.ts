import assert from "node:assert/strict";
import test from "node:test";
import type {
  ProspectActionStatus,
  ProspectStatus,
  UserRole,
} from "@prisma/client";

import {
  cancelProspectActionCore,
  canCancelProspectAction,
  canCompleteProspectAction,
  compareProspectActionsForListing,
  completeProspectActionCore,
  createProspectActionCore,
  createProspectActionWithAutoProgressionCore,
  isOverdueProspectAction,
  type CancelProspectActionDependencies,
  type CompleteProspectActionDependencies,
  type CreateProspectActionDependencies,
  type CreateProspectActionWithAutoProgressionDependencies,
  type ProspectActionActor,
  type ProspectActionRow,
} from "./prospect-action.service-core";

function actor(id: string, role: UserRole): ProspectActionActor {
  return { id, role };
}

function row(overrides: Partial<ProspectActionRow> = {}): ProspectActionRow {
  return {
    id: "action-1",
    prospectId: "prospect-1",
    assignedToUserId: "assignee-1",
    createdByUserId: "creator-1",
    status: "OPEN",
    title: "Faire une démonstration",
    description: null,
    dueAt: new Date("2026-08-14T10:00:00.000Z"),
    completedAt: null,
    completedByUserId: null,
    canceledAt: null,
    canceledByUserId: null,
    cancellationReason: null,
    createdAt: new Date("2026-08-10T09:00:00.000Z"),
    updatedAt: new Date("2026-08-10T09:00:00.000Z"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// isOverdueProspectAction — overdue is derived, never persisted
// ---------------------------------------------------------------------------

test("isOverdueProspectAction is true only for an OPEN action whose dueAt has passed", () => {
  const now = new Date("2026-08-15T00:00:00.000Z");

  assert.equal(
    isOverdueProspectAction(
      { status: "OPEN", dueAt: new Date("2026-08-14T10:00:00.000Z") },
      now,
    ),
    true,
  );
  assert.equal(
    isOverdueProspectAction(
      { status: "OPEN", dueAt: new Date("2026-08-20T10:00:00.000Z") },
      now,
    ),
    false,
  );
});

for (const status of ["COMPLETED", "CANCELED"] as ProspectActionStatus[]) {
  test(`isOverdueProspectAction is always false for a terminal (${status}) action, even with a past dueAt`, () => {
    assert.equal(
      isOverdueProspectAction(
        { status, dueAt: new Date("2020-01-01T00:00:00.000Z") },
        new Date("2026-08-15T00:00:00.000Z"),
      ),
      false,
    );
  });
}

// ---------------------------------------------------------------------------
// Permission matrix — role-neutral by design (Ticket 15H.1 philosophy)
// ---------------------------------------------------------------------------

test("canCompleteProspectAction: the assignee may always complete their own action, regardless of role", () => {
  for (const role of ["ADMIN", "MANAGER", "COMMERCIAL"] as UserRole[]) {
    assert.equal(
      canCompleteProspectAction(actor("assignee-1", role), {
        assignedToUserId: "assignee-1",
      }),
      true,
    );
  }
});

test("canCompleteProspectAction: ADMIN and MANAGER may complete anyone's action", () => {
  assert.equal(
    canCompleteProspectAction(actor("admin-1", "ADMIN"), {
      assignedToUserId: "assignee-1",
    }),
    true,
  );
  assert.equal(
    canCompleteProspectAction(actor("manager-1", "MANAGER"), {
      assignedToUserId: "assignee-1",
    }),
    true,
  );
});

test("canCompleteProspectAction: an unrelated COMMERCIAL cannot complete someone else's action", () => {
  assert.equal(
    canCompleteProspectAction(actor("other-commercial", "COMMERCIAL"), {
      assignedToUserId: "assignee-1",
    }),
    false,
  );
});

test("canCancelProspectAction: creator, assignee, ADMIN, and MANAGER may cancel", () => {
  const action = { createdByUserId: "creator-1", assignedToUserId: "assignee-1" };

  assert.equal(canCancelProspectAction(actor("creator-1", "COMMERCIAL"), action), true);
  assert.equal(canCancelProspectAction(actor("assignee-1", "COMMERCIAL"), action), true);
  assert.equal(canCancelProspectAction(actor("admin-1", "ADMIN"), action), true);
  assert.equal(canCancelProspectAction(actor("manager-1", "MANAGER"), action), true);
});

test("canCancelProspectAction: an unrelated COMMERCIAL cannot cancel someone else's task", () => {
  assert.equal(
    canCancelProspectAction(actor("bystander", "COMMERCIAL"), {
      createdByUserId: "creator-1",
      assignedToUserId: "assignee-1",
    }),
    false,
  );
});

// ---------------------------------------------------------------------------
// Ordering — OPEN first, then dueAt ASC, then createdAt DESC, then id
// ---------------------------------------------------------------------------

test("compareProspectActionsForListing sorts OPEN actions before terminal ones", () => {
  const open = row({ id: "open", status: "OPEN" });
  const completed = row({ id: "done", status: "COMPLETED" });

  const sorted = [completed, open].sort(compareProspectActionsForListing);
  assert.deepEqual(sorted.map((item) => item.id), ["open", "done"]);
});

test("compareProspectActionsForListing sorts OPEN actions by soonest due date first", () => {
  const soon = row({
    id: "soon",
    status: "OPEN",
    dueAt: new Date("2026-08-12T10:00:00.000Z"),
  });
  const later = row({
    id: "later",
    status: "OPEN",
    dueAt: new Date("2026-08-20T10:00:00.000Z"),
  });

  const sorted = [later, soon].sort(compareProspectActionsForListing);
  assert.deepEqual(sorted.map((item) => item.id), ["soon", "later"]);
});

test("compareProspectActionsForListing breaks same-dueAt ties by newest-created first", () => {
  const sameDue = new Date("2026-08-12T10:00:00.000Z");
  const older = row({
    id: "older",
    dueAt: sameDue,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
  });
  const newer = row({
    id: "newer",
    dueAt: sameDue,
    createdAt: new Date("2026-08-05T00:00:00.000Z"),
  });

  const sorted = [older, newer].sort(compareProspectActionsForListing);
  assert.deepEqual(sorted.map((item) => item.id), ["newer", "older"]);
});

test("compareProspectActionsForListing is deterministic for exact ties (id tie-break)", () => {
  const identical = row({ id: "same" });
  assert.equal(compareProspectActionsForListing(identical, { ...identical }), 0);
});

// ---------------------------------------------------------------------------
// createProspectActionCore
// ---------------------------------------------------------------------------

function validCreateInput() {
  return {
    prospectId: "prospect-1",
    assignedToUserId: "assignee-1",
    title: "Faire une démonstration",
    description: undefined,
    dueAt: new Date("2026-08-14T10:00:00.000Z"),
  };
}

test("createProspectActionCore creates an OPEN action when the prospect exists and the assignee is active", async () => {
  const created: unknown[] = [];
  const dependencies: CreateProspectActionDependencies = {
    findProspect: async () => ({ id: "prospect-1" }),
    findAssignee: async () => ({ id: "assignee-1", active: true, role: "COMMERCIAL" }),
    create: async (createdByUserId, fields) => {
      created.push({ createdByUserId, ...fields });
      return { id: "action-1" };
    },
  };

  const result = await createProspectActionCore(
    "creator-1",
    validCreateInput(),
    dependencies,
  );

  assert.deepEqual(result, { success: true, actionId: "action-1" });
  assert.deepEqual(created, [
    {
      createdByUserId: "creator-1",
      prospectId: "prospect-1",
      assignedToUserId: "assignee-1",
      title: "Faire une démonstration",
      description: undefined,
      dueAt: new Date("2026-08-14T10:00:00.000Z"),
    },
  ]);
});

test("createProspectActionCore rejects when the prospect is not found or not accessible (ownership scoping happens via findProspect)", async () => {
  const dependencies: CreateProspectActionDependencies = {
    findProspect: async () => null,
    findAssignee: async () => {
      throw new Error("must not check the assignee before the prospect");
    },
    create: async () => {
      throw new Error("must not create when the prospect lookup fails");
    },
  };

  const result = await createProspectActionCore(
    "creator-1",
    validCreateInput(),
    dependencies,
  );

  assert.deepEqual(result, {
    success: false,
    code: "PROSPECT_NOT_FOUND",
    message: "Ce prospect n’existe pas ou n’est pas accessible.",
  });
});

test("createProspectActionCore rejects an inactive assignee", async () => {
  const dependencies: CreateProspectActionDependencies = {
    findProspect: async () => ({ id: "prospect-1" }),
    findAssignee: async () => ({ id: "assignee-1", active: false, role: "COMMERCIAL" }),
    create: async () => {
      throw new Error("must not create with an inactive assignee");
    },
  };

  const result = await createProspectActionCore(
    "creator-1",
    validCreateInput(),
    dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "ASSIGNEE_NOT_AVAILABLE");
  }
});

test("Ticket 25M §14/§15: createProspectActionCore rejects ASSISTANT as an assignee server-side, even for an active user, even if a forged request bypasses the UI", async () => {
  const dependencies: CreateProspectActionDependencies = {
    findProspect: async () => ({ id: "prospect-1" }),
    findAssignee: async () => ({ id: "assignee-1", active: true, role: "ASSISTANT" }),
    create: async () => {
      throw new Error("must not create with an ineligible assignee");
    },
  };

  const result = await createProspectActionCore(
    "creator-1",
    validCreateInput(),
    dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "ASSIGNEE_NOT_ELIGIBLE");
  }
});

for (const role of ["ADMIN", "MANAGER", "COMMERCIAL"] as const) {
  test(`Ticket 25M §14: createProspectActionCore still accepts every pre-25M eligible assignee role (${role})`, async () => {
    const dependencies: CreateProspectActionDependencies = {
      findProspect: async () => ({ id: "prospect-1" }),
      findAssignee: async () => ({ id: "assignee-1", active: true, role }),
      create: async () => ({ id: "action-1" }),
    };

    const result = await createProspectActionCore(
      "creator-1",
      validCreateInput(),
      dependencies,
    );

    assert.equal(result.success, true);
  });
}

test("createProspectActionCore rejects an assignee that doesn't exist", async () => {
  const dependencies: CreateProspectActionDependencies = {
    findProspect: async () => ({ id: "prospect-1" }),
    findAssignee: async () => null,
    create: async () => {
      throw new Error("must not create with a missing assignee");
    },
  };

  const result = await createProspectActionCore(
    "creator-1",
    validCreateInput(),
    dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "ASSIGNEE_NOT_AVAILABLE");
  }
});

test("createProspectActionCore reports a controlled failure when the underlying create throws", async (context) => {
  context.mock.method(console, "error", () => undefined);

  const dependencies: CreateProspectActionDependencies = {
    findProspect: async () => ({ id: "prospect-1" }),
    findAssignee: async () => ({ id: "assignee-1", active: true, role: "COMMERCIAL" }),
    create: async () => {
      throw new Error("simulated database failure");
    },
  };

  const result = await createProspectActionCore(
    "creator-1",
    validCreateInput(),
    dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "CREATE_FAILED");
  }
});

// ---------------------------------------------------------------------------
// createProspectActionWithAutoProgressionCore — Ticket 22D
// ---------------------------------------------------------------------------

function autoProgressionDependencies(
  prospect: { id: string; status: ProspectStatus } | null,
  overrides: Partial<CreateProspectActionWithAutoProgressionDependencies> = {},
): {
  dependencies: CreateProspectActionWithAutoProgressionDependencies;
  progressionCalls: string[];
} {
  const progressionCalls: string[] = [];

  return {
    progressionCalls,
    dependencies: {
      findProspect: async () => prospect,
      findAssignee: async () => ({ id: "assignee-1", active: true, role: "COMMERCIAL" }),
      create: async (createdByUserId, fields) => {
        void createdByUserId;
        void fields;
        return { id: "action-1" };
      },
      progressNewProspectToFollowUp: async (prospectId) => {
        progressionCalls.push(prospectId);
        return { count: 1 };
      },
      ...overrides,
    },
  };
}

test("createProspectActionWithAutoProgressionCore progresses a NEW prospect to TO_FOLLOW_UP after a successful action creation", async () => {
  const { dependencies, progressionCalls } = autoProgressionDependencies({
    id: "prospect-1",
    status: "NEW",
  });

  const result = await createProspectActionWithAutoProgressionCore(
    "creator-1",
    validCreateInput(),
    dependencies,
  );

  assert.deepEqual(result, { success: true, actionId: "action-1" });
  assert.deepEqual(progressionCalls, ["prospect-1"]);
});

const nonNewStatuses: ProspectStatus[] = [
  "TO_FOLLOW_UP",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "WON",
  "LOST",
];

for (const status of nonNewStatuses) {
  test(`createProspectActionWithAutoProgressionCore leaves a ${status} prospect unchanged after action creation`, async () => {
    const { dependencies, progressionCalls } = autoProgressionDependencies({
      id: "prospect-1",
      status,
    });

    const result = await createProspectActionWithAutoProgressionCore(
      "creator-1",
      validCreateInput(),
      dependencies,
    );

    assert.equal(result.success, true);
    assert.deepEqual(
      progressionCalls,
      [],
      "the guarded update must never even be called for a non-NEW prospect",
    );
  });
}

test("createProspectActionWithAutoProgressionCore never progresses status when the action creation itself fails", async () => {
  const { dependencies, progressionCalls } = autoProgressionDependencies(
    { id: "prospect-1", status: "NEW" },
    {
      findAssignee: async () => ({ id: "assignee-1", active: false, role: "COMMERCIAL" }),
    },
  );

  const result = await createProspectActionWithAutoProgressionCore(
    "creator-1",
    validCreateInput(),
    dependencies,
  );

  assert.equal(result.success, false);
  assert.deepEqual(
    progressionCalls,
    [],
    "no status change may accompany a failed action creation",
  );
});

test("createProspectActionWithAutoProgressionCore reports PROSPECT_NOT_FOUND without ever touching progression or assignee lookup", async () => {
  const { dependencies, progressionCalls } = autoProgressionDependencies(null, {
    findAssignee: async () => {
      throw new Error("must not check the assignee before the prospect");
    },
  });

  const result = await createProspectActionWithAutoProgressionCore(
    "creator-1",
    validCreateInput(),
    dependencies,
  );

  assert.deepEqual(result, {
    success: false,
    code: "PROSPECT_NOT_FOUND",
    message: "Ce prospect n’existe pas ou n’est pas accessible.",
  });
  assert.deepEqual(progressionCalls, []);
});

test("createProspectActionWithAutoProgressionCore only issues a single findProspect lookup — the resolved prospect is reused, not re-fetched", async () => {
  let findProspectCalls = 0;
  const dependencies: CreateProspectActionWithAutoProgressionDependencies = {
    findProspect: async () => {
      findProspectCalls += 1;
      return { id: "prospect-1", status: "NEW" };
    },
    findAssignee: async () => ({ id: "assignee-1", active: true, role: "COMMERCIAL" }),
    create: async () => ({ id: "action-1" }),
    progressNewProspectToFollowUp: async () => ({ count: 1 }),
  };

  await createProspectActionWithAutoProgressionCore(
    "creator-1",
    validCreateInput(),
    dependencies,
  );

  assert.equal(findProspectCalls, 1);
});

test("createProspectActionWithAutoProgressionCore: a stale/concurrent guarded update (count 0) does not fail the overall creation — the newer status wins silently", async () => {
  const { dependencies } = autoProgressionDependencies(
    { id: "prospect-1", status: "NEW" },
    {
      progressNewProspectToFollowUp: async () => ({ count: 0 }),
    },
  );

  const result = await createProspectActionWithAutoProgressionCore(
    "creator-1",
    validCreateInput(),
    dependencies,
  );

  assert.deepEqual(result, { success: true, actionId: "action-1" });
});

test("createProspectActionWithAutoProgressionCore propagates a thrown progression error instead of swallowing it, so a wrapping prisma.$transaction rolls back the action too", async () => {
  const { dependencies } = autoProgressionDependencies(
    { id: "prospect-1", status: "NEW" },
    {
      progressNewProspectToFollowUp: async () => {
        throw new Error("simulated database failure during guarded update");
      },
    },
  );

  await assert.rejects(
    () =>
      createProspectActionWithAutoProgressionCore(
        "creator-1",
        validCreateInput(),
        dependencies,
      ),
    /simulated database failure/,
  );
});

// ---------------------------------------------------------------------------
// completeProspectActionCore
// ---------------------------------------------------------------------------

function completeDependencies(
  action: ProspectActionRow | null,
  completeCount = 1,
): { dependencies: CompleteProspectActionDependencies; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    dependencies: {
      findById: async () => action,
      completeAtomically: async (actionId, completedByUserId) => {
        calls.push(`${actionId}:${completedByUserId}`);
        return { count: completeCount };
      },
    },
  };
}

test("completeProspectActionCore completes an OPEN action for its assignee", async () => {
  const action = row();
  const { dependencies, calls } = completeDependencies(action);

  const result = await completeProspectActionCore(
    actor("assignee-1", "COMMERCIAL"),
    "action-1",
    dependencies,
  );

  assert.deepEqual(result, { success: true, prospectId: "prospect-1" });
  assert.deepEqual(calls, ["action-1:assignee-1"]);
});

test("completeProspectActionCore lets ADMIN/MANAGER complete an action assigned to someone else", async () => {
  const action = row();
  const { dependencies } = completeDependencies(action);

  const result = await completeProspectActionCore(
    actor("admin-1", "ADMIN"),
    "action-1",
    dependencies,
  );

  assert.equal(result.success, true);
});

test("completeProspectActionCore denies an unrelated COMMERCIAL", async () => {
  const action = row();
  const { dependencies, calls } = completeDependencies(action);

  const result = await completeProspectActionCore(
    actor("bystander", "COMMERCIAL"),
    "action-1",
    dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "ACCESS_DENIED");
  }
  assert.deepEqual(calls, [], "must never reach the atomic write when denied");
});

test("completeProspectActionCore reports NOT_FOUND for an unknown action", async () => {
  const { dependencies } = completeDependencies(null);

  const result = await completeProspectActionCore(
    actor("assignee-1", "COMMERCIAL"),
    "missing",
    dependencies,
  );

  assert.deepEqual(result, {
    success: false,
    code: "NOT_FOUND",
    message: "Cette action est introuvable.",
  });
});

test("completeProspectActionCore rejects completing an already-COMPLETED action without writing again", async () => {
  const action = row({ status: "COMPLETED", completedByUserId: "assignee-1" });
  const { dependencies, calls } = completeDependencies(action);

  const result = await completeProspectActionCore(
    actor("assignee-1", "COMMERCIAL"),
    "action-1",
    dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "ALREADY_COMPLETED");
  }
  assert.deepEqual(calls, []);
});

test("completeProspectActionCore rejects completing a CANCELED action", async () => {
  const action = row({ status: "CANCELED" });
  const { dependencies } = completeDependencies(action);

  const result = await completeProspectActionCore(
    actor("assignee-1", "COMMERCIAL"),
    "action-1",
    dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "ALREADY_CANCELED");
  }
});

test("completeProspectActionCore: two concurrent completions — only the atomic write's outcome decides, the second reports CONCURRENTLY_MODIFIED", async () => {
  const action = row();
  const { dependencies } = completeDependencies(action, 0);

  const result = await completeProspectActionCore(
    actor("assignee-1", "COMMERCIAL"),
    "action-1",
    dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "CONCURRENTLY_MODIFIED");
  }
});

test("completeProspectActionCore reports a controlled failure when the atomic write throws", async (context) => {
  context.mock.method(console, "error", () => undefined);
  const action = row();
  const dependencies: CompleteProspectActionDependencies = {
    findById: async () => action,
    completeAtomically: async () => {
      throw new Error("simulated database failure");
    },
  };

  const result = await completeProspectActionCore(
    actor("assignee-1", "COMMERCIAL"),
    "action-1",
    dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "COMPLETE_FAILED");
  }
});

// ---------------------------------------------------------------------------
// cancelProspectActionCore
// ---------------------------------------------------------------------------

function cancelDependencies(
  action: ProspectActionRow | null,
  cancelCount = 1,
): { dependencies: CancelProspectActionDependencies; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    dependencies: {
      findById: async () => action,
      cancelAtomically: async (actionId, canceledByUserId, reason) => {
        calls.push(`${actionId}:${canceledByUserId}:${reason}`);
        return { count: cancelCount };
      },
    },
  };
}

test("cancelProspectActionCore cancels an OPEN action for its creator, recording the reason", async () => {
  const action = row();
  const { dependencies, calls } = cancelDependencies(action);

  const result = await cancelProspectActionCore(
    actor("creator-1", "COMMERCIAL"),
    "action-1",
    "Le client a reporté le rendez-vous.",
    dependencies,
  );

  assert.deepEqual(result, { success: true, prospectId: "prospect-1" });
  assert.deepEqual(calls, [
    "action-1:creator-1:Le client a reporté le rendez-vous.",
  ]);
});

test("cancelProspectActionCore denies a COMMERCIAL who is neither the creator nor the assignee", async () => {
  const action = row();
  const { dependencies, calls } = cancelDependencies(action);

  const result = await cancelProspectActionCore(
    actor("bystander", "COMMERCIAL"),
    "action-1",
    "Motif quelconque",
    dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "ACCESS_DENIED");
  }
  assert.deepEqual(calls, []);
});

test("cancelProspectActionCore rejects canceling an already-terminal action", async () => {
  const completed = row({ status: "COMPLETED" });
  const { dependencies: completedDeps } = cancelDependencies(completed);
  const completedResult = await cancelProspectActionCore(
    actor("creator-1", "COMMERCIAL"),
    "action-1",
    "Motif",
    completedDeps,
  );
  assert.equal(completedResult.success, false);
  if (!completedResult.success) {
    assert.equal(completedResult.code, "ALREADY_COMPLETED");
  }

  const canceled = row({ status: "CANCELED" });
  const { dependencies: canceledDeps } = cancelDependencies(canceled);
  const canceledResult = await cancelProspectActionCore(
    actor("creator-1", "COMMERCIAL"),
    "action-1",
    "Motif",
    canceledDeps,
  );
  assert.equal(canceledResult.success, false);
  if (!canceledResult.success) {
    assert.equal(canceledResult.code, "ALREADY_CANCELED");
  }
});

test("cancelProspectActionCore: a completion that wins the race leaves the cancellation with CONCURRENTLY_MODIFIED", async () => {
  const action = row();
  const { dependencies } = cancelDependencies(action, 0);

  const result = await cancelProspectActionCore(
    actor("creator-1", "COMMERCIAL"),
    "action-1",
    "Motif",
    dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "CONCURRENTLY_MODIFIED");
  }
});

// ---------------------------------------------------------------------------
// Ownership / product neutrality (Ticket 20A/20B philosophy)
// ---------------------------------------------------------------------------

test("permission checks never depend on RelaisProduct — the row shape carries no product field at all", () => {
  const action = row();
  assert.equal("product" in action, false);
});

test("every current role (ADMIN, MANAGER, COMMERCIAL) can be a valid assignee/creator/completer/canceler — no role is special-cased in canCompleteProspectAction beyond ADMIN/MANAGER's elevated reach", () => {
  for (const role of ["ADMIN", "MANAGER", "COMMERCIAL"] as UserRole[]) {
    assert.equal(
      canCompleteProspectAction(actor("same-user", role), {
        assignedToUserId: "same-user",
      }),
      true,
    );
  }
});
