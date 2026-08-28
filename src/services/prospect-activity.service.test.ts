import assert from "node:assert/strict";
import test from "node:test";
import type { ProspectActivity } from "@prisma/client";

import type { ValidatedProspectActivityInput } from "@/src/lib/validations/prospect-activity.schema";
import type { AuthenticatedUser } from "@/src/services/authorization.service-core";
import {
  createProspectActivityCore,
  getProspectActivitiesCore,
  type ProspectActivityCreateDependencies,
} from "./prospect-activity.service-core";

function validInput(
  overrides: Partial<ValidatedProspectActivityInput> = {},
): ValidatedProspectActivityInput {
  return {
    prospectId: "prospect-1",
    type: "PHONE_CALL",
    summary: "Appel avec le directeur",
    details: "Il demande une démonstration.",
    occurredAt: new Date("2026-08-03T10:30:00.000Z"),
    ...overrides,
  };
}

function actor(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: "user-1",
    firstName: "Aminata",
    lastName: "Traoré",
    role: "ADMIN",
    ...overrides,
  };
}

function activity(
  id: string,
  occurredAt: string,
  createdAt: string,
  overrides: Partial<ProspectActivity> = {},
): ProspectActivity {
  return {
    id,
    prospectId: "prospect-1",
    type: "PHONE_CALL",
    summary: `Interaction ${id}`,
    details: null,
    occurredAt: new Date(occurredAt),
    agentName: "Aminata Traoré",
    conversionOutcome: null,
    conversionReason: null,
    conversionReasonNote: null,
    creditedUserId: null,
    creditedUserNameAtEvent: null,
    creditedUserRoleAtEvent: null,
    createdAt: new Date(createdAt),
    ...overrides,
  };
}

test("retrieves every activity newest-first with deterministic ties", async () => {
  const result = await getProspectActivitiesCore("prospect-1", {
    findProspect: async () => ({ id: "prospect-1" }),
    findActivities: async () => [
      activity("old", "2026-08-01T10:00:00.000Z", "2026-08-01T11:00:00.000Z"),
      activity("tie-old", "2026-08-03T10:00:00.000Z", "2026-08-03T11:00:00.000Z"),
      activity("tie-new", "2026-08-03T10:00:00.000Z", "2026-08-03T12:00:00.000Z"),
    ],
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(
      result.activities.map((item) => item.id),
      ["tie-new", "tie-old", "old"],
    );
  }
});

test("INTERNAL_NOTE remains available in the legitimate prospect history", async () => {
  const privateSentinel = "PRIVATE_INTERNAL_NOTE_SHOULD_NEVER_LEAVE_PROSPECT";
  const internalNote = activity(
    "internal-note-1",
    "2026-08-08T15:00:00.000Z",
    "2026-08-08T15:01:00.000Z",
    {
      type: "INTERNAL_NOTE",
      summary: "Note interne",
      details: privateSentinel,
    },
  );

  const result = await getProspectActivitiesCore("prospect-1", {
    findProspect: async () => ({ id: "prospect-1" }),
    findActivities: async () => [internalNote],
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.activities[0].type, "INTERNAL_NOTE");
    assert.equal(result.activities[0].details, privateSentinel);
  }
});

test("returns a controlled not-found result for an unknown prospect", async () => {
  const readResult = await getProspectActivitiesCore("missing", {
    findProspect: async () => null,
    findActivities: async () => {
      throw new Error("Activities should not be queried");
    },
  });
  const state = createTransactionalState(false);
  const createResult = await createProspectActivityCore(
    validInput({ prospectId: "missing" }),
    actor(),
    state.dependencies,
  );

  assert.deepEqual(readResult, {
    success: false,
    code: "NOT_FOUND",
    message: "Ce prospect n’existe pas.",
  });
  assert.equal(createResult.success, false);
  assert.equal(state.activities.length, 0);
});

test("creates multiple append-only activities without changing original notes", async () => {
  const state = createTransactionalState(true);

  const first = await createProspectActivityCore(
    validInput({ summary: "Premier appel" }),
    actor(),
    state.dependencies,
  );
  const second = await createProspectActivityCore(
    validInput({ summary: "Deuxième appel" }),
    actor(),
    state.dependencies,
  );

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.deepEqual(
    state.activities.map((item) => item.summary),
    ["Premier appel", "Deuxième appel"],
  );
});

// Ticket 22B — the generic interaction path no longer accepts or persists
// any commercial-state mutation. There is no `updateProspect` dependency
// left in ProspectActivityCreateDependencies for it to call — this test
// documents that guarantee at the behavioral level, not just the type
// level, by asserting the only thing that ever happens is one activity
// row appearing.
test("creating a generic interaction never mutates prospect commercial state", async () => {
  const state = createTransactionalState(true);

  const result = await createProspectActivityCore(
    validInput(),
    actor(),
    state.dependencies,
  );

  assert.equal(result.success, true);
  assert.deepEqual(
    state.activities.map((item) => item.type),
    ["PHONE_CALL"],
  );
  assert.equal(state.activities.length, 1);
});

test("rolls back activity creation when the prospect is not found", async () => {
  const state = createTransactionalState(false);

  const result = await createProspectActivityCore(
    validInput(),
    actor(),
    state.dependencies,
  );

  assert.deepEqual(result, {
    success: false,
    code: "NOT_FOUND",
    message: "Ce prospect n’existe plus.",
  });
  assert.equal(state.activities.length, 0);
});

// Ticket 22B — attribution always derives from the authenticated actor.
// The input type has no agentName field anymore, so this also proves any
// stray client-supplied value can't reach the persisted row even if a
// caller forced one through with a type assertion.
test("interaction author derives from the authenticated actor, never client input", async () => {
  const state = createTransactionalState(true);

  const spoofed = {
    ...validInput(),
    agentName: "Quelqu'un d'autre",
  } as ValidatedProspectActivityInput;

  const result = await createProspectActivityCore(
    spoofed,
    actor({ firstName: "Julbert", lastName: "Sermé" }),
    state.dependencies,
  );

  assert.equal(result.success, true);
  assert.deepEqual(
    state.activities.map((item) => item.agentName),
    ["Julbert Sermé"],
  );
});

function createTransactionalState(prospectExists: boolean) {
  const activities: Array<{
    id: string;
    type: string;
    summary: string;
    agentName: string;
  }> = [];
  let nextId = 1;

  const dependencies: ProspectActivityCreateDependencies = {
    runTransaction: async (work) =>
      work({
        findProspect: async () =>
          prospectExists ? { id: "prospect-1" } : null,
        createActivity: async (data) => {
          const id = `activity-${nextId++}`;
          activities.push({
            id,
            type: data.type,
            summary: data.summary,
            agentName: data.agentName,
          });
          return { id };
        },
      }),
  };

  return { activities, dependencies };
}
