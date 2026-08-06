import assert from "node:assert/strict";
import test from "node:test";

import type { ValidatedProspectInput } from "@/src/lib/validations/prospect.schema";
import type { PossibleSchoolDuplicate } from "./school-duplicate.service-core";
import {
  buildProspectData,
  createProspectCore,
  type AssignedUserCandidate,
  type CreateProspectCoreDependencies,
} from "./prospect-creation.service-core";

function validInput(
  overrides: Partial<ValidatedProspectInput> = {},
): ValidatedProspectInput {
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
    duplicateSchoolReviewed: false,
    schoolType: "Privée",
    ...overrides,
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
    findPossibleDuplicates: async () => [],
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

test("never checks for duplicates on a non-KARMDA product", async () => {
  const scenario = createScenario(user(), [duplicate()]);
  const result = await createProspectCore(
    validInput({ product: "LOKARI", propertyOwnerType: "Bailleur" }),
    scenario.dependencies,
  );

  assert.equal(result.success, true);
  assert.equal(scenario.findPossibleDuplicatesCalls, 0);
  assert.equal(scenario.createCalls, 1);
});

test("KARMDA with no possible duplicates creates normally without acknowledgment", async () => {
  const scenario = createScenario(user(), []);
  const result = await createProspectCore(
    validInput({ duplicateSchoolReviewed: false }),
    scenario.dependencies,
  );

  assert.equal(result.success, true);
  assert.equal(scenario.createCalls, 1);
});

test("KARMDA with possible duplicates and no acknowledgment is rejected", async () => {
  const scenario = createScenario(user(), [duplicate()]);
  const result = await createProspectCore(
    validInput({ duplicateSchoolReviewed: false }),
    scenario.dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "POSSIBLE_SCHOOL_DUPLICATE_REVIEW_REQUIRED");
  }
  assert.equal(scenario.createCalls, 0);
});

test("KARMDA with possible duplicates and acknowledgment succeeds", async () => {
  const scenario = createScenario(user(), [duplicate()]);
  const result = await createProspectCore(
    validInput({ duplicateSchoolReviewed: true }),
    scenario.dependencies,
  );

  assert.equal(result.success, true);
  assert.equal(scenario.createCalls, 1);
});

test("an exact-name match is just one more possible duplicate, not a special-cased rejection", async () => {
  const scenario = createScenario(user(), [
    duplicate({ name: validInput().name }),
  ]);
  const result = await createProspectCore(
    validInput({ duplicateSchoolReviewed: true }),
    scenario.dependencies,
  );

  assert.equal(result.success, true);
});

test("the server always rechecks duplicates for KARMDA, never trusting a stale client acknowledgment alone", async () => {
  const scenario = createScenario(user(), [duplicate()]);
  await createProspectCore(
    validInput({ duplicateSchoolReviewed: true }),
    scenario.dependencies,
  );

  assert.equal(scenario.findPossibleDuplicatesCalls, 1);
});

test("the duplicate acknowledgment is never persisted to the Prospect record", () => {
  const data = buildProspectData(
    validInput({ duplicateSchoolReviewed: true }),
    "Aminata Ouédraogo",
  );

  assert.equal("duplicateSchoolReviewed" in data, false);
});

test("existing KARMDA fields still make it into the persisted data alongside the acknowledgment being dropped", () => {
  const data = buildProspectData(
    validInput({ duplicateSchoolReviewed: true, schoolType: "Privée" }),
    "Aminata Ouédraogo",
  );

  assert.equal(data.name, "École Wend-Panga");
  assert.equal(data.product, "KARMDA");
  assert.equal("schoolType" in data && data.schoolType, "Privée");
});

function createScenario(
  candidate: AssignedUserCandidate | null,
  possibleDuplicates: PossibleSchoolDuplicate[] = [],
) {
  let createCalls = 0;
  let findPossibleDuplicatesCalls = 0;
  const dependencies: CreateProspectCoreDependencies = {
    findAssignedUser: async () => candidate,
    findPossibleDuplicates: async () => {
      findPossibleDuplicatesCalls += 1;
      return possibleDuplicates;
    },
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
    get findPossibleDuplicatesCalls() {
      return findPossibleDuplicatesCalls;
    },
  };
}

function duplicate(
  overrides: Partial<PossibleSchoolDuplicate> = {},
): PossibleSchoolDuplicate {
  return {
    id: "existing-1",
    name: "École Wend-Panga",
    location: "Ouagadougou",
    assignedUserName: "Awa Traoré",
    status: "NEW",
    interest: "MAYBE",
    lastContactAt: null,
    ...overrides,
  };
}
