import assert from "node:assert/strict";
import test from "node:test";

import {
  buildExactSchoolNameWhere,
  buildSchoolNameStartsWithWhere,
  findPossibleSchoolDuplicatesCore,
  presentPossibleSchoolDuplicate,
  type FindPossibleSchoolDuplicatesDependencies,
  type SchoolDuplicateCandidateRow,
} from "./school-duplicate.service-core";

function row(overrides: Partial<SchoolDuplicateCandidateRow> = {}): SchoolDuplicateCandidateRow {
  return {
    id: "prospect-1",
    name: "École Karpala",
    location: "Ouagadougou",
    status: "NEW",
    interest: "MAYBE",
    agentName: "Fallback Agent",
    assignedUser: null,
    activities: [],
    ...overrides,
  };
}

test("buildExactSchoolNameWhere scopes to KARMDA and an exact case-insensitive name", () => {
  const where = buildExactSchoolNameWhere("  École Karpala  ");

  assert.deepEqual(where, {
    product: "KARMDA",
    name: { equals: "École Karpala", mode: "insensitive" },
  });
});

test("buildSchoolNameStartsWithWhere scopes to KARMDA and a case-insensitive prefix", () => {
  const where = buildSchoolNameStartsWithWhere("École");

  assert.deepEqual(where, {
    product: "KARMDA",
    name: { startsWith: "École", mode: "insensitive" },
  });
});

test("presentPossibleSchoolDuplicate exposes only the restricted DTO fields", () => {
  const dto = presentPossibleSchoolDuplicate(row());

  assert.deepEqual(Object.keys(dto).sort(), [
    "assignedUserName",
    "id",
    "interest",
    "lastContactAt",
    "location",
    "name",
    "status",
  ]);
});

test("presentPossibleSchoolDuplicate falls back to the agentName snapshot when unassigned", () => {
  const dto = presentPossibleSchoolDuplicate(row());
  assert.equal(dto.assignedUserName, "Fallback Agent");
});

test("presentPossibleSchoolDuplicate prefers the live assigned user's name", () => {
  const dto = presentPossibleSchoolDuplicate(
    row({ assignedUser: { firstName: "Aïcha", lastName: "Sawadogo" } }),
  );
  assert.equal(dto.assignedUserName, "Aïcha Sawadogo");
});

test("presentPossibleSchoolDuplicate reports no last contact when no activities were logged", () => {
  const dto = presentPossibleSchoolDuplicate(row({ activities: [] }));
  assert.equal(dto.lastContactAt, null);
});

function dependencies(
  overrides: Partial<FindPossibleSchoolDuplicatesDependencies> = {},
): FindPossibleSchoolDuplicatesDependencies & {
  calls: Record<"exact" | "startsWith" | "contains", number>;
} {
  const calls = { exact: 0, startsWith: 0, contains: 0 };

  return {
    calls,
    findByExactName: async (name) => {
      calls.exact += 1;
      return overrides.findByExactName
        ? overrides.findByExactName(name)
        : [];
    },
    findByNameStartingWith: async (name) => {
      calls.startsWith += 1;
      return overrides.findByNameStartingWith
        ? overrides.findByNameStartingWith(name)
        : [];
    },
    findByNameContaining: async (name) => {
      calls.contains += 1;
      return overrides.findByNameContaining
        ? overrides.findByNameContaining(name)
        : [];
    },
  };
}

test("does not query anything below the minimum useful search length", async () => {
  const deps = dependencies();

  const matches = await findPossibleSchoolDuplicatesCore("ec", deps);

  assert.deepEqual(matches, []);
  assert.equal(deps.calls.exact, 0);
  assert.equal(deps.calls.startsWith, 0);
  assert.equal(deps.calls.contains, 0);
});

test("returns an empty array when no tier finds anything", async () => {
  const deps = dependencies();

  const matches = await findPossibleSchoolDuplicatesCore("École Karpala", deps);

  assert.deepEqual(matches, []);
});

test("an exact match ranks before a match only found by a later tier", async () => {
  const exactRow = row({ id: "exact-1", name: "École Karpala" });
  const startsWithRow = row({ id: "starts-1", name: "École Karpala Nord" });

  const deps = dependencies({
    findByExactName: async () => [exactRow],
    findByNameStartingWith: async () => [startsWithRow],
  });

  const matches = await findPossibleSchoolDuplicatesCore("École Karpala", deps);

  assert.deepEqual(
    matches.map((match) => match.id),
    ["exact-1", "starts-1"],
  );
});

test("deduplicates a row returned by more than one tier", async () => {
  const sameRow = row({ id: "dup-1" });

  const deps = dependencies({
    findByExactName: async () => [sameRow],
    findByNameStartingWith: async () => [sameRow],
  });

  const matches = await findPossibleSchoolDuplicatesCore("École Karpala", deps);

  assert.equal(matches.length, 1);
});

test("caps results at 5 and stops calling further tiers once satisfied", async () => {
  const exactRows = Array.from({ length: 5 }, (_, index) =>
    row({ id: `exact-${index}`, name: `École ${index}` }),
  );

  const deps = dependencies({ findByExactName: async () => exactRows });

  const matches = await findPossibleSchoolDuplicatesCore("École", deps);

  assert.equal(matches.length, 5);
  assert.equal(deps.calls.exact, 1);
  assert.equal(deps.calls.startsWith, 0);
  assert.equal(deps.calls.contains, 0);
});

test("still queries later tiers when an earlier tier is not enough on its own", async () => {
  const deps = dependencies({
    findByExactName: async () => [row({ id: "exact-1" })],
    findByNameContaining: async () => [row({ id: "contains-1" })],
  });

  const matches = await findPossibleSchoolDuplicatesCore("École", deps);

  assert.equal(deps.calls.exact, 1);
  assert.equal(deps.calls.startsWith, 1);
  assert.equal(deps.calls.contains, 1);
  assert.deepEqual(
    matches.map((match) => match.id),
    ["exact-1", "contains-1"],
  );
});
