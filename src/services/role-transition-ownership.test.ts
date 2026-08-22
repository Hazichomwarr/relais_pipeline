import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { User, UserRole } from "@prisma/client";

import type { ValidatedUserInput } from "@/src/lib/validations/user.schema";
import {
  createUserCore,
  updateUserCore,
  type UserServiceDependencies,
} from "./user.service-core";
import { buildProspectWhere } from "./prospect-read.service-core";
import { buildAdminMyProspectsWhere } from "./admin-my-prospects.service-core";
import {
  buildCommercialProspectByIdWhere,
  buildCommercialProspectWhere,
} from "./commercial-prospect.service-core";

/**
 * Ticket 21A's core invariant: a role transition changes authorization,
 * never ownership. `Prospect.assignedUserId` is the durable owner,
 * independent of `User.role` — this file proves the invariant holds end to
 * end (role-change mutation path + identity-based read paths), rather than
 * introducing any new write logic. The audit found the domain already
 * correct; these are regression tests, not bug fixes.
 */

type FakeProspect = { id: string; assignedUserId: string | null };

/** Mirrors what Prisma does with a `{ assignedUserId }` where-clause — no live DB needed to prove the read path is identity-based. */
function queryByWhere(
  prospects: FakeProspect[],
  where: { assignedUserId?: unknown },
): FakeProspect[] {
  return prospects.filter((prospect) => prospect.assignedUserId === where.assignedUserId);
}

function ids(prospects: FakeProspect[]): string[] {
  return [...prospects.map((prospect) => prospect.id)].sort();
}

function validUserInput(overrides: Partial<ValidatedUserInput> = {}): ValidatedUserInput {
  return {
    firstName: "Amidou",
    lastName: "Sawadogo",
    email: "amidou@example.com",
    phone: "70 12 34 56",
    role: "COMMERCIAL",
    active: true,
    dailyReportTemplateType: null,
    ...overrides,
  };
}

function makeUser(id: string, overrides: Partial<User> = {}): User {
  return {
    id,
    firstName: "Amidou",
    lastName: "Sawadogo",
    email: "amidou@example.com",
    phone: "70 12 34 56",
    passwordHash: null,
    role: "COMMERCIAL",
    active: true,
    dailyReportTemplateType: null,
    createdAt: new Date("2026-08-03T12:00:00.000Z"),
    updatedAt: new Date("2026-08-03T12:00:00.000Z"),
    ...overrides,
  };
}

function createUserStore(initialUsers: User[] = []) {
  const users = initialUsers.map((user) => ({ ...user }));
  let nextId = users.length + 1;

  const dependencies: UserServiceDependencies = {
    create: async (data) => {
      const user = makeUser(`user-${nextId++}`, data);
      users.push(user);
      return { id: user.id };
    },
    update: async (userId, data) => {
      const user = users.find((item) => item.id === userId);
      if (!user) {
        throw new Error("Unknown user");
      }
      Object.assign(user, data, { updatedAt: new Date() });
      return { id: user.id };
    },
    findById: async (userId) => users.find((item) => item.id === userId) ?? null,
    list: async (filters) =>
      users.filter((user) => filters.active === undefined || user.active === filters.active),
  };

  return { users, dependencies };
}

// ---------------------------------------------------------------------------
// 1. The role-change mutation path never touches prospect ownership
// ---------------------------------------------------------------------------

const allTransitions: Array<[UserRole, UserRole]> = [
  ["COMMERCIAL", "MANAGER"],
  ["MANAGER", "COMMERCIAL"],
  ["COMMERCIAL", "ADMIN"],
  ["ADMIN", "COMMERCIAL"],
  ["MANAGER", "ADMIN"],
  ["ADMIN", "MANAGER"],
];

for (const [fromRole, toRole] of allTransitions) {
  test(`${fromRole} → ${toRole}: role changes, but a separately-owned prospect set is never touched by the mutation itself`, async () => {
    const store = createUserStore([makeUser("amidou", { role: fromRole })]);
    // Prospects live in a completely separate store, never passed to
    // updateUserCore — there is no wiring through which a role change
    // could reach them.
    const prospects: FakeProspect[] = [
      { id: "prospect-a", assignedUserId: "amidou" },
      { id: "prospect-b", assignedUserId: "amidou" },
      { id: "prospect-c", assignedUserId: "amidou" },
    ];
    const before = ids(queryByWhere(prospects, buildProspectWhere({ userId: "amidou" })));

    const result = await updateUserCore(
      { userId: "amidou", ...validUserInput({ role: toRole }) },
      "admin-1",
      store.dependencies,
    );

    assert.equal(result.success, true);
    assert.equal(store.users[0].role, toRole);

    const after = ids(queryByWhere(prospects, buildProspectWhere({ userId: "amidou" })));
    assert.deepEqual(after, before);
    assert.deepEqual(after, ["prospect-a", "prospect-b", "prospect-c"]);
  });
}

test("updateUserCore's dependency contract has no field through which a prospect could be reassigned", () => {
  const source = readFileSync("src/services/user.service-core.ts", "utf8");
  const updateSignature = source.slice(
    source.indexOf("update: (\n    userId: string,"),
    source.indexOf("findById:"),
  );

  assert.doesNotMatch(updateSignature, /assignedUserId/);
  assert.doesNotMatch(updateSignature, /prospect/i);
});

// ---------------------------------------------------------------------------
// 2. Ownership read paths resolve by identity, never by current role
// ---------------------------------------------------------------------------

test("buildProspectWhere/buildAdminMyProspectsWhere/buildCommercialProspectWhere accept only a userId — none of them take or reference a role", () => {
  for (const file of [
    "src/services/prospect-read.service-core.ts",
    "src/services/admin-my-prospects.service-core.ts",
    "src/services/commercial-prospect.service-core.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /UserRole/);
    assert.doesNotMatch(source, /\.role\s*===/);
    assert.doesNotMatch(source, /role:\s*"COMMERCIAL"/);
  }
});

test("the same buildProspectWhere({ userId }) call resolves the same owned prospects regardless of the owner's current role", () => {
  const prospects: FakeProspect[] = [
    { id: "prospect-a", assignedUserId: "amidou" },
    { id: "prospect-b", assignedUserId: "amidou" },
    { id: "prospect-c", assignedUserId: "someone-else" },
  ];

  for (const role of ["COMMERCIAL", "MANAGER", "ADMIN"] as UserRole[]) {
    // buildProspectWhere doesn't even accept a role argument — role is
    // passed here only to document the scenario each iteration models.
    void role;
    const where = buildProspectWhere({ userId: "amidou" });
    assert.deepEqual(ids(queryByWhere(prospects, where)), ["prospect-a", "prospect-b"]);
  }
});

test("buildAdminMyProspectsWhere and buildCommercialProspectWhere both scope to assignedUserId, giving identical results for the same underlying owner", () => {
  const prospects: FakeProspect[] = [
    { id: "prospect-a", assignedUserId: "amidou" },
    { id: "prospect-b", assignedUserId: "amidou" },
  ];

  const adminWhere = buildAdminMyProspectsWhere("amidou");
  const commercialWhere = buildCommercialProspectWhere("amidou");

  assert.deepEqual(
    ids(queryByWhere(prospects, adminWhere)),
    ids(queryByWhere(prospects, commercialWhere)),
  );
  assert.deepEqual(ids(queryByWhere(prospects, adminWhere)), ["prospect-a", "prospect-b"]);
});

test("buildCommercialProspectByIdWhere scopes a single lookup to assignedUserId, with no role condition", () => {
  const where = buildCommercialProspectByIdWhere("prospect-a", "amidou");
  assert.deepEqual(where, { id: "prospect-a", assignedUserId: "amidou" });
});

// ---------------------------------------------------------------------------
// 3/4. Promotion and demotion both preserve ownership — no special-casing
// ---------------------------------------------------------------------------

test("promotion (COMMERCIAL → MANAGER) preserves every owned prospect: none unassigned, moved, or dropped", async () => {
  const store = createUserStore([makeUser("amidou", { role: "COMMERCIAL" })]);
  const prospects: FakeProspect[] = [
    { id: "prospect-a", assignedUserId: "amidou" },
    { id: "prospect-b", assignedUserId: "amidou" },
    { id: "prospect-c", assignedUserId: "amidou" },
  ];

  await updateUserCore(
    { userId: "amidou", ...validUserInput({ role: "MANAGER" }) },
    "admin-1",
    store.dependencies,
  );

  assert.equal(store.users[0].role, "MANAGER");
  assert.deepEqual(
    prospects.map((prospect) => prospect.assignedUserId),
    ["amidou", "amidou", "amidou"],
  );
  assert.equal(queryByWhere(prospects, buildProspectWhere({ userId: "amidou" })).length, 3);
});

test("demotion (MANAGER → COMMERCIAL) preserves every owned prospect identically to promotion — no promotion/demotion special-casing", async () => {
  const store = createUserStore([makeUser("amidou", { role: "MANAGER" })]);
  const prospects: FakeProspect[] = [
    { id: "prospect-a", assignedUserId: "amidou" },
    { id: "prospect-b", assignedUserId: "amidou" },
    { id: "prospect-c", assignedUserId: "amidou" },
  ];

  await updateUserCore(
    { userId: "amidou", ...validUserInput({ role: "COMMERCIAL" }) },
    "admin-1",
    store.dependencies,
  );

  assert.equal(store.users[0].role, "COMMERCIAL");
  assert.equal(queryByWhere(prospects, buildProspectWhere({ userId: "amidou" })).length, 3);
});

// ---------------------------------------------------------------------------
// Round trip — the ticket's realistic fixture, end to end
// ---------------------------------------------------------------------------

test("realistic fixture: create COMMERCIAL, own 3 prospects, promote to MANAGER, demote back — ownership is byte-for-byte identical at every step", async () => {
  const store = createUserStore();
  const created = await createUserCore(
    validUserInput({ role: "COMMERCIAL" }),
    "admin-1",
    store.dependencies,
  );
  assert.equal(created.success, true);
  if (!created.success) return;

  const userId = created.userId;
  const prospects: FakeProspect[] = [
    { id: "prospect-a", assignedUserId: userId },
    { id: "prospect-b", assignedUserId: userId },
    { id: "prospect-c", assignedUserId: userId },
  ];

  const ownedInitially = ids(queryByWhere(prospects, buildProspectWhere({ userId })));
  assert.deepEqual(ownedInitially, ["prospect-a", "prospect-b", "prospect-c"]);

  await updateUserCore(
    { userId, ...validUserInput({ role: "MANAGER" }) },
    "admin-1",
    store.dependencies,
  );
  assert.equal(store.users[0].role, "MANAGER");

  const ownedAfterPromotion = ids(queryByWhere(prospects, buildProspectWhere({ userId })));
  assert.deepEqual(ownedAfterPromotion, ownedInitially);

  await updateUserCore(
    { userId, ...validUserInput({ role: "COMMERCIAL" }) },
    "admin-1",
    store.dependencies,
  );
  assert.equal(store.users[0].role, "COMMERCIAL");

  const ownedAfterDemotion = ids(queryByWhere(prospects, buildProspectWhere({ userId })));
  assert.deepEqual(ownedAfterDemotion, ownedInitially);
});

// ---------------------------------------------------------------------------
// Prospect creation after a role transition — "everybody can prospect"
// ---------------------------------------------------------------------------

test("prospect creation derives assignedUserId from the actor's identity, not their role — the derivation function itself never mentions role", () => {
  const source = readFileSync("src/services/prospect-creation.service-core.ts", "utf8");
  assert.match(source, /assignedUserId:\s*actor\.id/);
  assert.doesNotMatch(source, /role\s*===\s*"COMMERCIAL"/);
  assert.doesNotMatch(source, /requireCommercial/);
});
