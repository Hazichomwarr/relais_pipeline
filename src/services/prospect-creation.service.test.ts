import assert from "node:assert/strict";
import test from "node:test";

import type { ValidatedProspectInput } from "@/src/lib/validations/prospect.schema";
import type { PossibleSchoolDuplicate } from "./school-duplicate.service-core";
import {
  buildProspectData,
  createProspectCore,
  type CreateProspectCoreDependencies,
  type ProspectCreationActor,
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
    duplicateSchoolReviewed: false,
    schoolType: "Privée",
    ...overrides,
  };
}

function actor(overrides: Partial<ProspectCreationActor> = {}): ProspectCreationActor {
  return {
    id: "user-1",
    firstName: "Aminata",
    lastName: "Ouédraogo",
    role: "COMMERCIAL",
    ...overrides,
  };
}

test("creates a prospect owned by the actor, with a full-name snapshot", async () => {
  let createdInput: ValidatedProspectInput | undefined;
  let createdActor: ProspectCreationActor | undefined;
  const result = await createProspectCore(actor(), validInput(), {
    findPossibleDuplicates: async () => [],
    create: async (input, creationActor) => {
      createdInput = input;
      createdActor = creationActor;
      return { id: "prospect-1" };
    },
  });

  assert.deepEqual(result, { success: true, prospectId: "prospect-1" });
  assert.equal(createdActor?.id, "user-1");
  assert.equal(createdInput?.name, "École Wend-Panga");
});

for (const role of ["ADMIN", "MANAGER", "COMMERCIAL"] as const) {
  test(`accepts every pre-25M eligible role as a prospect owner (${role})`, async () => {
    const scenario = createScenario();
    const result = await createProspectCore(
      actor({ id: `user-${role}`, role }),
      validInput(),
      scenario.dependencies,
    );

    assert.equal(result.success, true);
    assert.equal(scenario.createCalls, 1);
  });
}

test("Ticket 25M §10/§12: rejects ASSISTANT as a prospect owner, server-side, before any duplicate lookup or write", async () => {
  const scenario = createScenario();
  const result = await createProspectCore(
    actor({ id: "user-assistant", role: "ASSISTANT" }),
    validInput(),
    scenario.dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "ROLE_NOT_ELIGIBLE_FOR_OWNERSHIP");
  }
  assert.equal(scenario.createCalls, 0);
});

test("never checks for duplicates on a non-KARMDA product", async () => {
  const scenario = createScenario([duplicate()]);
  const result = await createProspectCore(
    actor(),
    validInput({ product: "LOKARI", propertyOwnerType: "Bailleur" }),
    scenario.dependencies,
  );

  assert.equal(result.success, true);
  assert.equal(scenario.findPossibleDuplicatesCalls, 0);
  assert.equal(scenario.createCalls, 1);
});

test("KARMDA with no possible duplicates creates normally without acknowledgment", async () => {
  const scenario = createScenario([]);
  const result = await createProspectCore(
    actor(),
    validInput({ duplicateSchoolReviewed: false }),
    scenario.dependencies,
  );

  assert.equal(result.success, true);
  assert.equal(scenario.createCalls, 1);
});

test("KARMDA with possible duplicates and no acknowledgment is rejected", async () => {
  const scenario = createScenario([duplicate()]);
  const result = await createProspectCore(
    actor(),
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
  const scenario = createScenario([duplicate()]);
  const result = await createProspectCore(
    actor(),
    validInput({ duplicateSchoolReviewed: true }),
    scenario.dependencies,
  );

  assert.equal(result.success, true);
  assert.equal(scenario.createCalls, 1);
});

test("an exact-name match is just one more possible duplicate, not a special-cased rejection", async () => {
  const scenario = createScenario([duplicate({ name: validInput().name })]);
  const result = await createProspectCore(
    actor(),
    validInput({ duplicateSchoolReviewed: true }),
    scenario.dependencies,
  );

  assert.equal(result.success, true);
});

test("the server always rechecks duplicates for KARMDA, never trusting a stale client acknowledgment alone", async () => {
  const scenario = createScenario([duplicate()]);
  await createProspectCore(
    actor(),
    validInput({ duplicateSchoolReviewed: true }),
    scenario.dependencies,
  );

  assert.equal(scenario.findPossibleDuplicatesCalls, 1);
});

test("the duplicate acknowledgment is never persisted to the Prospect record", () => {
  const data = buildProspectData(
    validInput({ duplicateSchoolReviewed: true }),
    actor(),
  );

  assert.equal("duplicateSchoolReviewed" in data, false);
});

test("existing KARMDA fields still make it into the persisted data alongside the acknowledgment being dropped", () => {
  const data = buildProspectData(
    validInput({ duplicateSchoolReviewed: true, schoolType: "Privée" }),
    actor(),
  );

  assert.equal(data.name, "École Wend-Panga");
  assert.equal(data.product, "KARMDA");
  assert.equal("schoolType" in data && data.schoolType, "Privée");
});

test("ownership is always derived from the actor — assignedUserId and agentName never come from the validated input", () => {
  const data = buildProspectData(
    validInput(),
    actor({ id: "user-42", firstName: "Julbert", lastName: "Sermé" }),
  );

  assert.equal(data.assignedUserId, "user-42");
  assert.equal(data.agentName, "Julbert Sermé");
});

function createScenario(possibleDuplicates: PossibleSchoolDuplicate[] = []) {
  let createCalls = 0;
  let findPossibleDuplicatesCalls = 0;
  const dependencies: CreateProspectCoreDependencies = {
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
