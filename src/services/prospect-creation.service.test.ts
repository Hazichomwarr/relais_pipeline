import assert from "node:assert/strict";
import test from "node:test";

import type { ValidatedProspectInput } from "@/src/lib/validations/prospect.schema";
import {
  createProspectCore,
  type AssignedUserCandidate,
  type CreateProspectCoreDependencies,
} from "./prospect-creation.service-core";

function validInput(): ValidatedProspectInput {
  return {
    product: "KARMDA",
    name: "École Wend-Panga",
    prospectType: "École privée",
    contactName: "Mme Kaboré",
    phone: "70 12 34 56",
    location: "Ouagadougou",
    interest: "INTERESTED",
    status: "NEW",
    notes: "Le directeur souhaite organiser une démonstration.",
    assignedUserId: "user-1",
    schoolType: "Privée",
  };
}

function user(
  overrides: Partial<AssignedUserCandidate> = {},
): AssignedUserCandidate {
  return {
    id: "user-1",
    firstName: "Aminata",
    lastName: "Ouédraogo",
    role: "COMMERCIAL",
    active: true,
    ...overrides,
  };
}

test("creates a prospect with assignedUserId and the full-name snapshot", async () => {
  let createdInput: ValidatedProspectInput | undefined;
  let snapshot: string | undefined;
  const result = await createProspectCore(validInput(), {
    findAssignedUser: async () => user(),
    create: async (input, agentNameSnapshot) => {
      createdInput = input;
      snapshot = agentNameSnapshot;
      return { id: "prospect-1" };
    },
  });

  assert.deepEqual(result, { success: true, prospectId: "prospect-1" });
  assert.equal(createdInput?.assignedUserId, "user-1");
  assert.equal(snapshot, "Aminata Ouédraogo");
});

test("rejects an unknown User without creating a prospect", async () => {
  const scenario = createScenario(null);
  const result = await createProspectCore(validInput(), scenario.dependencies);

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "ASSIGNED_USER_NOT_FOUND");
  }
  assert.equal(scenario.createCalls, 0);
});

test("rejects an inactive commercial without creating a prospect", async () => {
  const scenario = createScenario(user({ active: false }));
  const result = await createProspectCore(validInput(), scenario.dependencies);

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "ASSIGNED_USER_INACTIVE");
  }
  assert.equal(scenario.createCalls, 0);
});

for (const role of ["ADMIN", "MANAGER"] as const) {
  test(`rejects a ${role} User without creating a prospect`, async () => {
    const scenario = createScenario(user({ role }));
    const result = await createProspectCore(
      validInput(),
      scenario.dependencies,
    );

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.code, "ASSIGNED_USER_NOT_COMMERCIAL");
    }
    assert.equal(scenario.createCalls, 0);
  });
}

test("accepts an active commercial", async () => {
  const scenario = createScenario(user());
  const result = await createProspectCore(validInput(), scenario.dependencies);

  assert.equal(result.success, true);
  assert.equal(scenario.createCalls, 1);
});

function createScenario(candidate: AssignedUserCandidate | null) {
  let createCalls = 0;
  const dependencies: CreateProspectCoreDependencies = {
    findAssignedUser: async () => candidate,
    create: async () => {
      createCalls += 1;
      return { id: "prospect-1" };
    },
  };

  return {
    dependencies,
    get createCalls() {
      return createCalls;
    },
  };
}
