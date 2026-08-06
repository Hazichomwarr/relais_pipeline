import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNextProspectWhere,
  buildPreviousProspectWhere,
  getAdjacentProspectsCore,
  nextProspectOrderBy,
  previousProspectOrderBy,
  type AdjacentProspectRef,
  type CurrentProspectForNavigation,
  type GetAdjacentProspectsDependencies,
} from "./prospect-navigation.service-core";

const CURRENT_CREATED_AT = new Date("2026-08-01T12:00:00.000Z");

function scoped() {
  return {
    id: "prospect-current",
    createdAt: CURRENT_CREATED_AT,
    assignedUserId: "commercial-1",
  };
}

test("buildPreviousProspectWhere scopes to the same assignedUserId and looks for newer-or-tied records", () => {
  const where = buildPreviousProspectWhere(scoped());

  assert.deepEqual(where, {
    assignedUserId: "commercial-1",
    OR: [
      { createdAt: { gt: CURRENT_CREATED_AT } },
      { createdAt: CURRENT_CREATED_AT, id: { gt: "prospect-current" } },
    ],
  });
});

test("buildNextProspectWhere scopes to the same assignedUserId and looks for older-or-tied records", () => {
  const where = buildNextProspectWhere(scoped());

  assert.deepEqual(where, {
    assignedUserId: "commercial-1",
    OR: [
      { createdAt: { lt: CURRENT_CREATED_AT } },
      { createdAt: CURRENT_CREATED_AT, id: { lt: "prospect-current" } },
    ],
  });
});

test("previous is ordered nearest-newer first (createdAt asc, id asc)", () => {
  assert.deepEqual(previousProspectOrderBy, [
    { createdAt: "asc" },
    { id: "asc" },
  ]);
});

test("next is ordered nearest-older first (createdAt desc, id desc)", () => {
  assert.deepEqual(nextProspectOrderBy, [
    { createdAt: "desc" },
    { id: "desc" },
  ]);
});

function current(
  overrides: Partial<CurrentProspectForNavigation> = {},
): CurrentProspectForNavigation {
  return {
    id: "prospect-c",
    createdAt: CURRENT_CREATED_AT,
    assignedUserId: "commercial-1",
    assignedUserName: "Amidou Koane",
    ...overrides,
  };
}

function dependencies(
  overrides: Partial<{
    previous: AdjacentProspectRef | null;
    next: AdjacentProspectRef | null;
  }> = {},
): GetAdjacentProspectsDependencies & {
  calls: { previous: number; next: number };
} {
  const calls = { previous: 0, next: 0 };

  return {
    calls,
    findPrevious: async () => {
      calls.previous += 1;
      return overrides.previous ?? null;
    },
    findNext: async () => {
      calls.next += 1;
      return overrides.next ?? null;
    },
  };
}

test("an unassigned prospect has no neighbors and never queries the database", async () => {
  const deps = dependencies({
    previous: { id: "would-be-previous", name: "Nope" },
    next: { id: "would-be-next", name: "Nope" },
  });

  const result = await getAdjacentProspectsCore(
    current({ assignedUserId: null, assignedUserName: "Sans commercial" }),
    deps,
  );

  assert.deepEqual(result, {
    previous: null,
    next: null,
    context: { assignedUserId: null, assignedUserName: "Sans commercial" },
  });
  assert.equal(deps.calls.previous, 0);
  assert.equal(deps.calls.next, 0);
});

test("returns both neighbors when they exist", async () => {
  const previous = { id: "prospect-d", name: "École D" };
  const next = { id: "prospect-b", name: "École B" };
  const deps = dependencies({ previous, next });

  const result = await getAdjacentProspectsCore(current(), deps);

  assert.deepEqual(result.previous, previous);
  assert.deepEqual(result.next, next);
  assert.deepEqual(result.context, {
    assignedUserId: "commercial-1",
    assignedUserName: "Amidou Koane",
  });
});

test("the first prospect in a portfolio has no previous", async () => {
  const next = { id: "prospect-b", name: "École B" };
  const result = await getAdjacentProspectsCore(
    current(),
    dependencies({ previous: null, next }),
  );

  assert.equal(result.previous, null);
  assert.deepEqual(result.next, next);
});

test("the last prospect in a portfolio has no next", async () => {
  const previous = { id: "prospect-d", name: "École D" };
  const result = await getAdjacentProspectsCore(
    current(),
    dependencies({ previous, next: null }),
  );

  assert.deepEqual(result.previous, previous);
  assert.equal(result.next, null);
});

test("the only prospect in a portfolio has neither, but context is still populated", async () => {
  const result = await getAdjacentProspectsCore(
    current(),
    dependencies({ previous: null, next: null }),
  );

  assert.equal(result.previous, null);
  assert.equal(result.next, null);
  assert.deepEqual(result.context, {
    assignedUserId: "commercial-1",
    assignedUserName: "Amidou Koane",
  });
});

test("an inactive assigned user's historical portfolio still navigates normally", async () => {
  // The core type never carries an "active" flag at all — scoping is purely
  // by assignedUserId, so an inactive user's prospects are indistinguishable
  // from an active one's as far as navigation is concerned.
  const previous = { id: "prospect-d", name: "École D" };
  const result = await getAdjacentProspectsCore(
    current({ assignedUserName: "Ancien Commercial" }),
    dependencies({ previous, next: null }),
  );

  assert.deepEqual(result.previous, previous);
  assert.equal(result.context.assignedUserName, "Ancien Commercial");
});
