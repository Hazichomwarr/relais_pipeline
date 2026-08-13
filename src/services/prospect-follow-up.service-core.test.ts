import assert from "node:assert/strict";
import test from "node:test";
import type { ProspectActionStatus, ProspectStatus, UserRole } from "@prisma/client";

import type { AuthenticatedUser } from "@/src/services/authorization.service-core";
import type { ProspectActionRow } from "@/src/services/prospect-action.service-core";
import {
  submitProspectFollowUpCore,
  type ProspectFollowUpTransactionContext,
  type ProspectFollowUpWorkflowDependencies,
} from "./prospect-follow-up.service-core";
import type { ValidatedProspectFollowUpWorkflowInput } from "@/src/lib/validations/prospect-follow-up.schema";

function actor(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: "actor-1",
    firstName: "Julbert",
    lastName: "Serme",
    role: "ADMIN" as UserRole,
    ...overrides,
  };
}

function baseInput(
  overrides: Partial<ValidatedProspectFollowUpWorkflowInput> = {},
): ValidatedProspectFollowUpWorkflowInput {
  return {
    prospectId: "prospect-1",
    note: "Le directeur souhaite une démonstration.",
    status: "QUALIFIED",
    interest: "INTERESTED",
    completedActionId: undefined,
    nextActionTitle: "Faire une démonstration",
    nextActionAssignedToUserId: "assignee-1",
    nextActionDueAt: new Date("2026-08-14T10:00:00.000Z"),
    ...overrides,
  };
}

function actionRow(overrides: Partial<ProspectActionRow> = {}): ProspectActionRow {
  return {
    id: "action-A",
    prospectId: "prospect-1",
    assignedToUserId: "actor-1",
    createdByUserId: "actor-1",
    status: "OPEN",
    title: "Appeler le directeur",
    description: null,
    dueAt: new Date("2026-08-12T10:00:00.000Z"),
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

type FakeStoreOptions = {
  prospect: { id: string; status: ProspectStatus; followUpDate: Date | null };
  actions?: ProspectActionRow[];
  users?: { id: string; active: boolean }[];
};

/**
 * Mimics Prisma's interactive-transaction commit/rollback semantics: all
 * writes land on staged copies, only merged into the "real" store if
 * `work` resolves. If `work` throws, the outer store is left completely
 * untouched — the same property a real prisma.$transaction guarantees.
 */
function createFakeStore(options: FakeStoreOptions) {
  let prospect = { ...options.prospect };
  let actions = (options.actions ?? []).map((a) => ({ ...a }));
  const users = options.users ?? [{ id: "assignee-1", active: true }];
  const activities: Array<{
    prospectId: string;
    type: string;
    summary: string;
    occurredAt: Date;
    agentName: string | undefined;
  }> = [];
  const updateCalls: Array<Record<string, unknown>> = [];

  const dependencies: ProspectFollowUpWorkflowDependencies = {
    runTransaction: async (work) => {
      let stagedProspect = { ...prospect };
      const stagedActions = actions.map((a) => ({ ...a }));
      const stagedActivities: typeof activities = [];
      let nextActionCounter = 0;

      const tx: ProspectFollowUpTransactionContext = {
        findProspect: async (id) =>
          stagedProspect.id === id
            ? { id: stagedProspect.id, status: stagedProspect.status }
            : null,
        updateProspect: async (id, data) => {
          if (stagedProspect.id !== id) {
            throw new Error("unknown prospect in test fake");
          }
          updateCalls.push({ ...data });
          stagedProspect = { ...stagedProspect, ...data };
        },
        createActivity: async (data) => {
          stagedActivities.push(data);
          return { id: `activity-${stagedActivities.length}` };
        },
        findById: async (actionId) =>
          stagedActions.find((row) => row.id === actionId) ?? null,
        completeAtomically: async (actionId, completedByUserId) => {
          const index = stagedActions.findIndex(
            (row) => row.id === actionId && row.status === "OPEN",
          );
          if (index === -1) {
            return { count: 0 };
          }
          stagedActions[index] = {
            ...stagedActions[index],
            status: "COMPLETED" as ProspectActionStatus,
            completedAt: new Date(),
            completedByUserId,
          };
          return { count: 1 };
        },
        findAssignee: async (userId) =>
          users.find((user) => user.id === userId) ?? null,
        create: async (createdByUserId, fields) => {
          nextActionCounter += 1;
          const id = `next-action-${nextActionCounter}`;
          stagedActions.push({
            id,
            prospectId: fields.prospectId,
            assignedToUserId: fields.assignedToUserId,
            createdByUserId,
            status: "OPEN",
            title: fields.title,
            description: fields.description ?? null,
            dueAt: fields.dueAt,
            completedAt: null,
            completedByUserId: null,
            canceledAt: null,
            canceledByUserId: null,
            cancellationReason: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          return { id };
        },
      };

      const result = await work(tx);

      // Commit — only reached if `work` resolved without throwing.
      prospect = stagedProspect;
      actions = stagedActions;
      activities.push(...stagedActivities);

      return result;
    },
  };

  return {
    dependencies,
    getProspect: () => prospect,
    getActions: () => actions,
    getActivities: () => activities,
    getUpdateCalls: () => updateCalls,
  };
}

test("standard follow-up: completes an existing action, updates status/interest, records FOLLOW_UP, and creates the next action", async () => {
  const store = createFakeStore({
    prospect: {
      id: "prospect-1",
      status: "CONTACTED",
      followUpDate: null,
    },
    actions: [actionRow({ id: "action-A", status: "OPEN" })],
  });

  const result = await submitProspectFollowUpCore(
    actor(),
    baseInput({ completedActionId: "action-A" }),
    store.dependencies,
  );

  assert.deepEqual(result, { success: true });
  assert.equal(store.getProspect().status, "QUALIFIED");
  assert.deepEqual(
    store.getActivities().map((item) => item.type),
    ["FOLLOW_UP"],
  );
  assert.equal(
    store.getActivities()[0].summary,
    "Le directeur souhaite une démonstration.",
  );

  const completedAction = store.getActions().find((a) => a.id === "action-A");
  assert.equal(completedAction?.status, "COMPLETED");
  assert.equal(completedAction?.completedByUserId, "actor-1");

  const nextAction = store
    .getActions()
    .find((a) => a.title === "Faire une démonstration");
  assert.ok(nextAction);
  assert.equal(nextAction?.status, "OPEN");
  assert.equal(nextAction?.createdByUserId, "actor-1");
  assert.equal(nextAction?.assignedToUserId, "assignee-1");
  assert.deepEqual(nextAction?.dueAt, new Date("2026-08-14T10:00:00.000Z"));
});

test("stores the follow-up note verbatim, with no truncation or rewriting", async () => {
  const longNote = "A".repeat(1500);
  const store = createFakeStore({
    prospect: { id: "prospect-1", status: "NEW", followUpDate: null },
  });

  await submitProspectFollowUpCore(
    actor(),
    baseInput({ note: longNote }),
    store.dependencies,
  );

  assert.equal(store.getActivities()[0].summary, longNote);
});

test("legacy compatibility: followUpDate is projected from the new action's dueAt; the legacy nextAction enum is never written", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", status: "NEW", followUpDate: null },
  });

  await submitProspectFollowUpCore(actor(), baseInput(), store.dependencies);

  assert.deepEqual(store.getUpdateCalls()[0], {
    status: "QUALIFIED",
    interest: "INTERESTED",
    followUpDate: new Date("2026-08-14T10:00:00.000Z"),
  });
  for (const call of store.getUpdateCalls()) {
    assert.equal("nextAction" in call, false);
  }
});

test("terminal follow-up leaves followUpDate untouched (no next action means no compatibility projection)", async () => {
  const store = createFakeStore({
    prospect: {
      id: "prospect-1",
      status: "PROPOSAL_SENT",
      followUpDate: new Date("2026-08-01T00:00:00.000Z"),
    },
  });

  await submitProspectFollowUpCore(
    actor(),
    baseInput({
      status: "WON",
      nextActionTitle: undefined,
      nextActionAssignedToUserId: undefined,
      nextActionDueAt: undefined,
    }),
    store.dependencies,
  );

  assert.deepEqual(store.getUpdateCalls()[0], {
    status: "WON",
    interest: "INTERESTED",
  });
});

test("active status without any next action fields is rejected before any write happens, even bypassing schema validation", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", status: "NEW", followUpDate: null },
  });

  const result = await submitProspectFollowUpCore(
    actor(),
    baseInput({
      status: "QUALIFIED",
      nextActionTitle: undefined,
      nextActionAssignedToUserId: undefined,
      nextActionDueAt: undefined,
    }),
    store.dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "NEXT_ACTION_REQUIRED");
    assert.equal(
      result.message,
      "Une prochaine action est requise tant que le prospect est actif.",
    );
  }
  assert.equal(store.getProspect().status, "NEW");
  assert.deepEqual(store.getActivities(), []);
  assert.deepEqual(store.getActions(), []);
});

for (const status of ["WON", "LOST"] as ProspectStatus[]) {
  test(`${status} follow-up requires no next action and creates none`, async () => {
    const store = createFakeStore({
      prospect: { id: "prospect-1", status: "PROPOSAL_SENT", followUpDate: null },
    });

    const result = await submitProspectFollowUpCore(
      actor(),
      baseInput({
        status,
        nextActionTitle: undefined,
        nextActionAssignedToUserId: undefined,
        nextActionDueAt: undefined,
      }),
      store.dependencies,
    );

    assert.deepEqual(result, { success: true });
    assert.equal(store.getProspect().status, status);
    assert.deepEqual(store.getActions(), []);
  });
}

test("WON follow-up writes exactly one FOLLOW_UP and one WON_TRANSITION activity", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", status: "PROPOSAL_SENT", followUpDate: null },
  });

  await submitProspectFollowUpCore(
    actor(),
    baseInput({
      status: "WON",
      nextActionTitle: undefined,
      nextActionAssignedToUserId: undefined,
      nextActionDueAt: undefined,
    }),
    store.dependencies,
  );

  assert.deepEqual(
    store.getActivities().map((item) => item.type),
    ["FOLLOW_UP", "WON_TRANSITION"],
  );
});

test("repeat WON follow-up never duplicates WON_TRANSITION (Ticket 18A invariant)", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", status: "WON", followUpDate: null },
  });

  await submitProspectFollowUpCore(
    actor(),
    baseInput({
      note: "Contrat signé et livré.",
      status: "WON",
      nextActionTitle: undefined,
      nextActionAssignedToUserId: undefined,
      nextActionDueAt: undefined,
    }),
    store.dependencies,
  );

  assert.deepEqual(
    store.getActivities().map((item) => item.type),
    ["FOLLOW_UP"],
  );
});

test("LOST follow-up records FOLLOW_UP but no durable transition marker (deferred to Ticket 20D)", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", status: "PROPOSAL_SENT", followUpDate: null },
  });

  await submitProspectFollowUpCore(
    actor(),
    baseInput({
      status: "LOST",
      nextActionTitle: undefined,
      nextActionAssignedToUserId: undefined,
      nextActionDueAt: undefined,
    }),
    store.dependencies,
  );

  assert.deepEqual(
    store.getActivities().map((item) => item.type),
    ["FOLLOW_UP"],
  );
});

test("unknown or inaccessible prospect rejects the whole submission", async () => {
  const store = createFakeStore({
    prospect: { id: "some-other-prospect", status: "NEW", followUpDate: null },
  });

  const result = await submitProspectFollowUpCore(
    actor(),
    baseInput(),
    store.dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "PROSPECT_NOT_FOUND");
  }
});

test("rejects completing an action the actor is not permitted to complete, with no partial persistence", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", status: "CONTACTED", followUpDate: null },
    actions: [
      actionRow({
        id: "action-A",
        assignedToUserId: "someone-else",
        createdByUserId: "someone-else",
      }),
    ],
  });

  const result = await submitProspectFollowUpCore(
    actor({ id: "bystander", role: "COMMERCIAL" }),
    baseInput({ completedActionId: "action-A" }),
    store.dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "ACCESS_DENIED");
  }
  assert.equal(store.getProspect().status, "CONTACTED");
  assert.deepEqual(store.getActivities(), []);
  assert.equal(store.getActions().find((a) => a.id === "action-A")?.status, "OPEN");
  assert.equal(store.getActions().length, 1, "no next action should have been created either");
});

test("a concurrently-completed selected action rolls back the whole follow-up, not just the completion step", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", status: "CONTACTED", followUpDate: null },
    actions: [actionRow({ id: "action-A", status: "COMPLETED" })],
  });

  const result = await submitProspectFollowUpCore(
    actor(),
    baseInput({ completedActionId: "action-A" }),
    store.dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "ALREADY_COMPLETED");
  }
  assert.equal(store.getProspect().status, "CONTACTED");
  assert.deepEqual(store.getActivities(), []);
});

test("assignee inactivation race: rejects next-action creation and rolls back an already-completed current action in the same submission", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", status: "CONTACTED", followUpDate: null },
    actions: [actionRow({ id: "action-A", status: "OPEN" })],
    users: [{ id: "assignee-1", active: false }],
  });

  const result = await submitProspectFollowUpCore(
    actor(),
    baseInput({ completedActionId: "action-A" }),
    store.dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "ASSIGNEE_NOT_AVAILABLE");
  }
  assert.equal(store.getProspect().status, "CONTACTED");
  assert.deepEqual(store.getActivities(), []);
  assert.equal(
    store.getActions().find((a) => a.id === "action-A")?.status,
    "OPEN",
    "Action A's completion must roll back too — no partial follow-up mutation",
  );
});

test("completing one action leaves unrelated parallel OPEN actions untouched", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", status: "CONTACTED", followUpDate: null },
    actions: [
      actionRow({ id: "action-A", status: "OPEN" }),
      actionRow({ id: "action-B", title: "Préparer le devis", status: "OPEN" }),
    ],
  });

  await submitProspectFollowUpCore(
    actor(),
    baseInput({ completedActionId: "action-A" }),
    store.dependencies,
  );

  assert.equal(store.getActions().find((a) => a.id === "action-A")?.status, "COMPLETED");
  assert.equal(store.getActions().find((a) => a.id === "action-B")?.status, "OPEN");
});

test("submitting with no completedActionId leaves every existing OPEN action untouched", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", status: "CONTACTED", followUpDate: null },
    actions: [actionRow({ id: "action-A", status: "OPEN" })],
  });

  await submitProspectFollowUpCore(actor(), baseInput(), store.dependencies);

  assert.equal(store.getActions().find((a) => a.id === "action-A")?.status, "OPEN");
});

test("product neutrality: the workflow has no product-specific branching — it never inspects a product field at all", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", status: "NEW", followUpDate: null },
  });

  const result = await submitProspectFollowUpCore(
    actor(),
    baseInput(),
    store.dependencies,
  );

  assert.equal(result.success, true);
  assert.equal("product" in store.getProspect(), false);
});

for (const role of ["ADMIN", "MANAGER", "COMMERCIAL"] as UserRole[]) {
  test(`ownership-neutral core: the workflow behaves identically regardless of actor role (${role}) — scoping is the caller's responsibility`, async () => {
    const store = createFakeStore({
      prospect: { id: "prospect-1", status: "NEW", followUpDate: null },
    });

    const result = await submitProspectFollowUpCore(
      actor({ role }),
      baseInput(),
      store.dependencies,
    );

    assert.equal(result.success, true);
    assert.equal(store.getProspect().status, "QUALIFIED");
  });
}

test("an unexpected error inside the transaction is reported as a controlled SUBMIT_FAILED result", async (context) => {
  context.mock.method(console, "error", () => undefined);

  const dependencies: ProspectFollowUpWorkflowDependencies = {
    runTransaction: async () => {
      throw new Error("simulated database failure");
    },
  };

  const result = await submitProspectFollowUpCore(
    actor(),
    baseInput(),
    dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "SUBMIT_FAILED");
  }
});
