import assert from "node:assert/strict";
import test from "node:test";
import type { ProspectActivity, ProspectStatus } from "@prisma/client";

import type { ValidatedProspectActivityInput } from "@/src/lib/validations/prospect-activity.schema";
import {
  createProspectActivityCore,
  getProspectActivitiesCore,
  type ProspectActivityCreateDependencies,
  type ProspectStateUpdates,
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
    agentName: "Aminata",
    ...overrides,
  };
}

function activity(
  id: string,
  occurredAt: string,
  createdAt: string,
): ProspectActivity {
  return {
    id,
    prospectId: "prospect-1",
    type: "PHONE_CALL",
    summary: `Interaction ${id}`,
    details: null,
    occurredAt: new Date(occurredAt),
    agentName: "Aminata",
    createdAt: new Date(createdAt),
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
    state.dependencies,
  );
  const second = await createProspectActivityCore(
    validInput({ summary: "Deuxième appel" }),
    state.dependencies,
  );

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.deepEqual(
    state.activities.map((item) => item.summary),
    ["Premier appel", "Deuxième appel"],
  );
  assert.equal(state.prospect.notes, "Observation terrain originale");
});

test("updates only explicitly supplied current follow-up fields", async () => {
  const state = createTransactionalState(true);
  const followUpDate = new Date("2026-08-05T12:00:00.000Z");

  const result = await createProspectActivityCore(
    validInput({
      interest: "READY_TO_DISCUSS",
      status: "QUALIFIED",
      nextAction: "SEND_DEMO",
      followUpDate,
    }),
    state.dependencies,
  );

  assert.equal(result.success, true);
  assert.deepEqual(state.lastUpdate, {
    interest: "READY_TO_DISCUSS",
    status: "QUALIFIED",
    nextAction: "SEND_DEMO",
    followUpDate,
  });
  assert.equal(state.prospect.notes, "Observation terrain originale");
});

test("leaves current state unchanged when optional updates are omitted", async () => {
  const state = createTransactionalState(true);
  const result = await createProspectActivityCore(
    validInput(),
    state.dependencies,
  );

  assert.equal(result.success, true);
  assert.equal(state.lastUpdate, undefined);
  assert.equal(state.prospect.status, "NEW");
});

test("rolls back activity creation when the prospect update fails", async (context) => {
  context.mock.method(console, "error", () => undefined);
  const state = createTransactionalState(true, true);

  const result = await createProspectActivityCore(
    validInput({ status: "QUALIFIED" }),
    state.dependencies,
  );

  assert.deepEqual(result, {
    success: false,
    code: "CREATE_FAILED",
    message: "L’interaction n’a pas pu être enregistrée. Veuillez réessayer.",
  });
  assert.equal(state.activities.length, 0);
  assert.equal(state.prospect.status, "NEW");
});

test("appends a WON_TRANSITION activity when this submission moves the prospect into WON", async () => {
  const state = createTransactionalState(true);

  const result = await createProspectActivityCore(
    validInput({ status: "WON", agentName: "Julbert Serme" }),
    state.dependencies,
  );

  assert.equal(result.success, true);
  assert.deepEqual(
    state.activities.map((item) => ({ type: item.type, summary: item.summary })),
    [
      { type: "PHONE_CALL", summary: "Appel avec le directeur" },
      {
        type: "WON_TRANSITION",
        summary: "Le prospect est devenu client (statut WON).",
      },
    ],
  );
});

test("does not append a WON_TRANSITION activity when the prospect is already WON", async () => {
  const state = createTransactionalState(true);
  state.prospect.status = "WON";

  const result = await createProspectActivityCore(
    validInput({ status: "WON" }),
    state.dependencies,
  );

  assert.equal(result.success, true);
  assert.deepEqual(
    state.activities.map((item) => item.type),
    ["PHONE_CALL"],
  );
});

test("does not append a WON_TRANSITION activity for a status change that isn't WON", async () => {
  const state = createTransactionalState(true);

  const result = await createProspectActivityCore(
    validInput({ status: "QUALIFIED" }),
    state.dependencies,
  );

  assert.equal(result.success, true);
  assert.deepEqual(
    state.activities.map((item) => item.type),
    ["PHONE_CALL"],
  );
});

function createTransactionalState(prospectExists: boolean, failUpdate = false) {
  const activities: Array<{
    id: string;
    type: string;
    summary: string;
  }> = [];
  const prospect: { id: string; status: ProspectStatus; notes: string } = {
    id: "prospect-1",
    status: "NEW",
    notes: "Observation terrain originale",
  };
  let lastUpdate: ProspectStateUpdates | undefined;
  let nextId = 1;

  const dependencies: ProspectActivityCreateDependencies = {
    runTransaction: async (work) => {
      const stagedActivities = activities.map((item) => ({ ...item }));
      const stagedProspect = { ...prospect };
      let stagedUpdate: ProspectStateUpdates | undefined;

      const result = await work({
        findProspect: async () =>
          prospectExists ? { id: prospect.id, status: prospect.status } : null,
        createActivity: async (data) => {
          const id = `activity-${nextId++}`;
          stagedActivities.push({ id, type: data.type, summary: data.summary });
          return { id };
        },
        updateProspect: async (_prospectId, data) => {
          if (failUpdate) {
            throw new Error("Simulated update failure");
          }

          stagedUpdate = data;
          if (data.status) {
            stagedProspect.status = data.status;
          }
        },
      });

      activities.splice(0, activities.length, ...stagedActivities);
      Object.assign(prospect, stagedProspect);
      lastUpdate = stagedUpdate;
      return result;
    },
  };

  return {
    activities,
    prospect,
    dependencies,
    get lastUpdate() {
      return lastUpdate;
    },
  };
}
