import assert from "node:assert/strict";
import test from "node:test";
import type {
  ProspectActionStatus,
  ProspectConversionReason,
  ProspectStatus,
  UserRole,
} from "@prisma/client";

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
    conversionOutcome: "ADVANCED",
    conversionReason: "DEMO_CONVINCED",
    conversionReasonNote: undefined,
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
  prospect: {
    id: string;
    status: ProspectStatus;
    followUpDate: Date | null;
    // Ticket 25H.1 — optional in the test fixture (most tests here aren't
    // about WON credit at all); defaults to "unassigned" so every existing
    // scenario keeps working unchanged, matching real Prisma nullability.
    assignedUserId?: string | null;
    assignedUser?: { firstName: string; lastName: string; role: UserRole } | null;
  };
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
  let prospect = {
    assignedUserId: null,
    assignedUser: null,
    ...options.prospect,
  };
  let actions = (options.actions ?? []).map((a) => ({ ...a }));
  const users = options.users ?? [{ id: "assignee-1", active: true }];
  const activities: Array<{
    prospectId: string;
    type: string;
    summary: string;
    occurredAt: Date;
    agentName: string | undefined;
    conversionOutcome?: string;
    conversionReason?: string;
    conversionReasonNote?: string;
    creditedUserId?: string | null;
    creditedUserNameAtEvent?: string | null;
    creditedUserRoleAtEvent?: string | null;
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
          stagedProspect.id === id ? { ...stagedProspect } : null,
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
    /**
     * Test-only: simulates ownership changing via some unrelated,
     * out-of-band operation (Ticket 25H.1 §37) — submitProspectFollowUpCore
     * itself has no path to reassign a prospect, so this exists purely to
     * prove that mutating current ownership after a WON transition has
     * already been recorded does not retroactively change the credit
     * already written into that ProspectActivity row.
     */
    reassign: (
      assignedUserId: string | null,
      assignedUser: FakeStoreOptions["prospect"]["assignedUser"] = null,
    ) => {
      prospect = { ...prospect, assignedUserId, assignedUser };
    },
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
      conversionOutcome: "WON",
      conversionReason: "GOOD_PRODUCT_FIT",
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

// ---------------------------------------------------------------------------
// Ticket 22D — a NEW prospect may skip TO_FOLLOW_UP entirely through an
// explicit structured follow-up; the automatic NEW -> TO_FOLLOW_UP
// inference is authorized only for standalone action creation
// (prospect-action.service-core.ts), never as a side effect here.
// ---------------------------------------------------------------------------

test("a NEW prospect's structured follow-up may land directly on another explicit status, bypassing TO_FOLLOW_UP", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", status: "NEW", followUpDate: null },
  });

  const result = await submitProspectFollowUpCore(
    actor(),
    baseInput({ status: "QUALIFIED" }),
    store.dependencies,
  );

  assert.deepEqual(result, { success: true });
  assert.equal(store.getProspect().status, "QUALIFIED");
});

const terminalOutcomeByStatus: Record<"WON" | "LOST", "WON" | "LOST"> = {
  WON: "WON",
  LOST: "LOST",
};
const terminalReasonByStatus: Record<"WON" | "LOST", ProspectConversionReason> = {
  WON: "GOOD_PRODUCT_FIT",
  LOST: "PRICE_TOO_HIGH",
};

for (const status of ["WON", "LOST"] as const) {
  test(`${status} follow-up requires no next action and creates none`, async () => {
    const store = createFakeStore({
      prospect: { id: "prospect-1", status: "PROPOSAL_SENT", followUpDate: null },
    });

    const result = await submitProspectFollowUpCore(
      actor(),
      baseInput({
        status,
        conversionOutcome: terminalOutcomeByStatus[status],
        conversionReason: terminalReasonByStatus[status],
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

test("WON follow-up writes exactly one FOLLOW_UP (carrying the structured outcome/reason) and one WON_TRANSITION activity", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", status: "PROPOSAL_SENT", followUpDate: null },
  });

  await submitProspectFollowUpCore(
    actor(),
    baseInput({
      status: "WON",
      conversionOutcome: "WON",
      conversionReason: "GOOD_PRODUCT_FIT",
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
  assert.equal(store.getActivities()[0].conversionOutcome, "WON");
  assert.equal(store.getActivities()[0].conversionReason, "GOOD_PRODUCT_FIT");
  assert.equal(
    store.getActivities()[1].conversionOutcome,
    undefined,
    "WON_TRANSITION stays the canonical transition marker — it doesn't also carry outcome/reason",
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
      conversionOutcome: "WON",
      conversionReason: "GOOD_PRODUCT_FIT",
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

test("LOST follow-up records a FOLLOW_UP with structured outcome/reason — this is now trustworthy durable LOST history", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", status: "PROPOSAL_SENT", followUpDate: null },
  });

  await submitProspectFollowUpCore(
    actor(),
    baseInput({
      status: "LOST",
      conversionOutcome: "LOST",
      conversionReason: "PRICE_TOO_HIGH",
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
  assert.equal(store.getActivities()[0].conversionOutcome, "LOST");
  assert.equal(store.getActivities()[0].conversionReason, "PRICE_TOO_HIGH");
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

test("STALLED follow-up on an active prospect still requires a next action and persists the structured reason", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", status: "QUALIFIED", followUpDate: null },
  });

  const result = await submitProspectFollowUpCore(
    actor(),
    baseInput({
      status: "QUALIFIED",
      conversionOutcome: "STALLED",
      conversionReason: "DECISION_MAKER_UNAVAILABLE",
    }),
    store.dependencies,
  );

  assert.deepEqual(result, { success: true });
  assert.equal(store.getProspect().status, "QUALIFIED");
  assert.equal(store.getActivities()[0].conversionOutcome, "STALLED");
  assert.equal(
    store.getActivities()[0].conversionReason,
    "DECISION_MAKER_UNAVAILABLE",
  );
  assert.ok(
    store.getActions().some((a) => a.title === "Faire une démonstration"),
    "STALLED does not exempt an active prospect from the Ticket 20C next-action rule",
  );
});

test("rejects an outcome/reason pair that is commercially incompatible, before any write happens", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", status: "QUALIFIED", followUpDate: null },
  });

  const result = await submitProspectFollowUpCore(
    actor(),
    baseInput({
      conversionOutcome: "ADVANCED",
      conversionReason: "NO_BUDGET",
    }),
    store.dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "CONVERSION_REASON_NOT_ALLOWED");
  }
  assert.deepEqual(store.getActivities(), []);
  assert.equal(store.getProspect().status, "QUALIFIED");
});

test("rejects OTHER without an explanation, and accepts it once one is provided", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", status: "QUALIFIED", followUpDate: null },
  });

  const rejected = await submitProspectFollowUpCore(
    actor(),
    baseInput({ conversionReason: "OTHER", conversionReasonNote: undefined }),
    store.dependencies,
  );
  assert.equal(rejected.success, false);
  if (!rejected.success) {
    assert.equal(rejected.code, "CONVERSION_REASON_NOTE_REQUIRED");
  }
  assert.deepEqual(store.getActivities(), []);

  const accepted = await submitProspectFollowUpCore(
    actor(),
    baseInput({
      conversionReason: "OTHER",
      conversionReasonNote: "Le responsable quitte le pays pour trois mois.",
    }),
    store.dependencies,
  );
  assert.deepEqual(accepted, { success: true });
  assert.equal(
    store.getActivities()[0].conversionReasonNote,
    "Le responsable quitte le pays pour trois mois.",
  );
});

test("a non-OTHER reason never requires an explanation", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", status: "QUALIFIED", followUpDate: null },
  });

  const result = await submitProspectFollowUpCore(
    actor(),
    baseInput({ conversionReasonNote: undefined }),
    store.dependencies,
  );

  assert.deepEqual(result, { success: true });
});

test("rejects status = WON with a non-WON outcome, and status = LOST with a non-LOST outcome", async () => {
  const wonStatusStore = createFakeStore({
    prospect: { id: "prospect-1", status: "PROPOSAL_SENT", followUpDate: null },
  });
  const wonMismatch = await submitProspectFollowUpCore(
    actor(),
    baseInput({
      status: "WON",
      conversionOutcome: "STALLED",
      conversionReason: "NO_BUDGET",
      nextActionTitle: undefined,
      nextActionAssignedToUserId: undefined,
      nextActionDueAt: undefined,
    }),
    wonStatusStore.dependencies,
  );
  assert.equal(wonMismatch.success, false);
  if (!wonMismatch.success) {
    assert.equal(wonMismatch.code, "CONVERSION_OUTCOME_STATUS_MISMATCH");
  }
  assert.deepEqual(wonStatusStore.getActivities(), []);

  const lostStatusStore = createFakeStore({
    prospect: { id: "prospect-1", status: "PROPOSAL_SENT", followUpDate: null },
  });
  const lostMismatch = await submitProspectFollowUpCore(
    actor(),
    baseInput({
      status: "LOST",
      conversionOutcome: "ADVANCED",
      nextActionTitle: undefined,
      nextActionAssignedToUserId: undefined,
      nextActionDueAt: undefined,
    }),
    lostStatusStore.dependencies,
  );
  assert.equal(lostMismatch.success, false);
  if (!lostMismatch.success) {
    assert.equal(lostMismatch.code, "CONVERSION_OUTCOME_STATUS_MISMATCH");
  }
  assert.deepEqual(lostStatusStore.getActivities(), []);
});

test("rejects an active resulting status paired with a WON or LOST outcome", async () => {
  const store = createFakeStore({
    prospect: { id: "prospect-1", status: "CONTACTED", followUpDate: null },
  });

  const wonOnActive = await submitProspectFollowUpCore(
    actor(),
    baseInput({
      status: "QUALIFIED",
      conversionOutcome: "WON",
      conversionReason: "GOOD_PRODUCT_FIT",
    }),
    store.dependencies,
  );
  assert.equal(wonOnActive.success, false);
  if (!wonOnActive.success) {
    assert.equal(wonOnActive.code, "CONVERSION_OUTCOME_STATUS_MISMATCH");
  }

  const lostOnActive = await submitProspectFollowUpCore(
    actor(),
    baseInput({
      status: "QUALIFIED",
      conversionOutcome: "LOST",
      conversionReason: "PRICE_TOO_HIGH",
    }),
    store.dependencies,
  );
  assert.equal(lostOnActive.success, false);
  if (!lostOnActive.success) {
    assert.equal(lostOnActive.code, "CONVERSION_OUTCOME_STATUS_MISMATCH");
  }

  assert.deepEqual(store.getActivities(), []);
});

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

// ---------------------------------------------------------------------------
// Ticket 25H.1 — durable commercial result attribution on WON transitions
// ---------------------------------------------------------------------------

function wonInput(
  overrides: Partial<ValidatedProspectFollowUpWorkflowInput> = {},
): ValidatedProspectFollowUpWorkflowInput {
  return baseInput({
    status: "WON",
    conversionOutcome: "WON",
    conversionReason: "DEMO_CONVINCED",
    nextActionTitle: undefined,
    nextActionAssignedToUserId: undefined,
    nextActionDueAt: undefined,
    ...overrides,
  });
}

function findWon(store: { getActivities: () => Array<{ type: string }> }) {
  return store
    .getActivities()
    .find((item) => item.type === "WON_TRANSITION") as
    | {
        type: string;
        agentName: string | undefined;
        creditedUserId?: string | null;
        creditedUserNameAtEvent?: string | null;
        creditedUserRoleAtEvent?: string | null;
      }
    | undefined;
}

for (const managerRole of ["MANAGER", "ADMIN"] as const) {
  test(`§18/§33/§34: a ${managerRole} closing a COMMERCIAL's prospect credits the COMMERCIAL, never the ${managerRole}`, async () => {
    const store = createFakeStore({
      prospect: {
        id: "prospect-1",
        status: "PROPOSAL_SENT",
        followUpDate: null,
        assignedUserId: "commercial-a",
        assignedUser: {
          firstName: "Aminata",
          lastName: "Traoré",
          role: "COMMERCIAL",
        },
      },
    });

    const result = await submitProspectFollowUpCore(
      actor({
        id: "manager-b",
        firstName: "Amidou",
        lastName: "Sawadogo",
        role: managerRole,
      }),
      wonInput(),
      store.dependencies,
    );

    assert.deepEqual(result, { success: true });
    const won = findWon(store);
    assert.ok(won);
    assert.equal(won?.agentName, "Amidou Sawadogo");
    assert.equal(won?.creditedUserId, "commercial-a");
    assert.equal(won?.creditedUserNameAtEvent, "Aminata Traoré");
    assert.equal(won?.creditedUserRoleAtEvent, "COMMERCIAL");
  });
}

test("§19/§35: a COMMERCIAL closing their own prospect — actor and credited employee are the same person", async () => {
  const store = createFakeStore({
    prospect: {
      id: "prospect-1",
      status: "PROPOSAL_SENT",
      followUpDate: null,
      assignedUserId: "commercial-a",
      assignedUser: {
        firstName: "Aminata",
        lastName: "Traoré",
        role: "COMMERCIAL",
      },
    },
  });

  const result = await submitProspectFollowUpCore(
    actor({
      id: "commercial-a",
      firstName: "Aminata",
      lastName: "Traoré",
      role: "COMMERCIAL",
    }),
    wonInput(),
    store.dependencies,
  );

  assert.deepEqual(result, { success: true });
  const won = findWon(store);
  assert.ok(won);
  assert.equal(won?.agentName, "Aminata Traoré");
  assert.equal(won?.creditedUserId, "commercial-a");
});

test("§17/§36: credit follows whoever is the authoritative owner at the moment of transition — reassigned-before-WON needs no special handling", async () => {
  const store = createFakeStore({
    prospect: {
      id: "prospect-1",
      status: "PROPOSAL_SENT",
      followUpDate: null,
      // As if reassigned from Commercial A to Commercial B before this
      // submission — resolveWonCredit only ever sees current, authoritative
      // ownership, never a history it would need to reconstruct.
      assignedUserId: "commercial-b",
      assignedUser: {
        firstName: "Fatou",
        lastName: "Zongo",
        role: "COMMERCIAL",
      },
    },
  });

  await submitProspectFollowUpCore(actor(), wonInput(), store.dependencies);

  assert.equal(findWon(store)?.creditedUserId, "commercial-b");
});

test("§12/§39: a prospect that becomes WON while unassigned has no credited employee — never a fallback to the closing actor", async () => {
  const store = createFakeStore({
    prospect: {
      id: "prospect-1",
      status: "PROPOSAL_SENT",
      followUpDate: null,
      assignedUserId: null,
      assignedUser: null,
    },
  });

  const result = await submitProspectFollowUpCore(
    actor({ id: "admin-1", role: "ADMIN" }),
    wonInput(),
    store.dependencies,
  );

  assert.deepEqual(result, { success: true });
  const won = findWon(store);
  assert.equal(won?.creditedUserId, null);
  assert.equal(won?.creditedUserNameAtEvent, null);
  assert.equal(won?.creditedUserRoleAtEvent, null);
  // Never silently credited to the actor who happened to close it.
  assert.notEqual(won?.creditedUserId, "admin-1");
});

test("§37: reassigning the prospect after WON does not rewrite the already-recorded credit", async () => {
  const store = createFakeStore({
    prospect: {
      id: "prospect-1",
      status: "PROPOSAL_SENT",
      followUpDate: null,
      assignedUserId: "commercial-a",
      assignedUser: {
        firstName: "Aminata",
        lastName: "Traoré",
        role: "COMMERCIAL",
      },
    },
  });

  await submitProspectFollowUpCore(actor(), wonInput(), store.dependencies);
  assert.equal(findWon(store)?.creditedUserId, "commercial-a");

  // Some unrelated later operation reassigns the (now-WON) prospect.
  store.reassign("commercial-b", {
    firstName: "Fatou",
    lastName: "Zongo",
    role: "COMMERCIAL",
  });

  assert.equal(store.getProspect().assignedUserId, "commercial-b");
  assert.equal(findWon(store)?.creditedUserId, "commercial-a");
  assert.equal(findWon(store)?.creditedUserNameAtEvent, "Aminata Traoré");
});

test("§25/§26: a prospect that leaves and re-enters WON produces two independent WON_TRANSITION events, each with its own credit snapshot", async () => {
  const store = createFakeStore({
    prospect: {
      id: "prospect-1",
      status: "PROPOSAL_SENT",
      followUpDate: null,
      assignedUserId: "commercial-a",
      assignedUser: {
        firstName: "Aminata",
        lastName: "Traoré",
        role: "COMMERCIAL",
      },
    },
  });

  await submitProspectFollowUpCore(actor(), wonInput(), store.dependencies);

  // Reassigned, then the prospect leaves WON and comes back — nothing in
  // this domain prevents that (Ticket 20A: no enforced state machine).
  store.reassign("commercial-b", {
    firstName: "Fatou",
    lastName: "Zongo",
    role: "COMMERCIAL",
  });
  await submitProspectFollowUpCore(
    actor(),
    baseInput({ status: "CONTACTED", conversionOutcome: "STALLED", conversionReason: "NEEDS_MORE_TIME" }),
    store.dependencies,
  );
  await submitProspectFollowUpCore(actor(), wonInput(), store.dependencies);

  const wonEvents = store
    .getActivities()
    .filter((item) => item.type === "WON_TRANSITION");

  assert.equal(wonEvents.length, 2);
  assert.equal(wonEvents[0].creditedUserId, "commercial-a");
  assert.equal(wonEvents[1].creditedUserId, "commercial-b");
});
