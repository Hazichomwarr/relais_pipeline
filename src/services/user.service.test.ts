import assert from "node:assert/strict";
import test from "node:test";
import type { User } from "@prisma/client";

import type {
  ValidatedUserInput,
  ValidatedUserUpdateInput,
} from "@/src/lib/validations/user.schema";
import {
  createUserCore,
  deactivateUserCore,
  getUserByIdCore,
  listUsersCore,
  updateOwnProfileCore,
  updateUserCore,
  type UserServiceDependencies,
  type UserStatusTransition,
} from "./user.service-core";

function validUserInput(
  overrides: Partial<ValidatedUserInput> = {},
): ValidatedUserInput {
  return {
    firstName: "Aminata",
    lastName: "Ouédraogo",
    email: "aminata@example.com",
    phone: "70 12 34 56",
    role: "COMMERCIAL",
    active: true,
    dailyReportTemplateType: null,
    ...overrides,
  };
}

test("creates and retrieves a user by id", async () => {
  const store = createUserStore();
  const created = await createUserCore(validUserInput(), store.dependencies);

  assert.equal(created.success, true);
  if (created.success) {
    const user = await getUserByIdCore(created.userId, store.dependencies);
    assert.equal(user?.firstName, "Aminata");
    assert.equal(user?.active, true);
  }
});

test("updates names, contact details, role, and active state", async () => {
  const store = createUserStore([makeUser("user-1")]);
  const input: ValidatedUserUpdateInput = {
    userId: "user-1",
    ...validUserInput({
      firstName: "Mariam",
      lastName: "Traoré",
      email: null,
      phone: null,
      role: "MANAGER",
      active: false,
    }),
  };
  const result = await updateUserCore(input, "admin-1", store.dependencies);

  assert.equal(result.success, true);
  assert.deepEqual(
    {
      firstName: store.users[0].firstName,
      lastName: store.users[0].lastName,
      email: store.users[0].email,
      phone: store.users[0].phone,
      role: store.users[0].role,
      active: store.users[0].active,
    },
    {
      firstName: "Mariam",
      lastName: "Traoré",
      email: null,
      phone: null,
      role: "MANAGER",
      active: false,
    },
  );
});

test("createUserCore persists an ADMIN-assigned daily report template", async () => {
  const store = createUserStore();
  const created = await createUserCore(
    validUserInput({ dailyReportTemplateType: "ASSISTANT" }),
    store.dependencies,
  );

  assert.equal(created.success, true);
  assert.equal(store.users[0].dailyReportTemplateType, "ASSISTANT");
});

test("a user may be created with no daily report template assigned", async () => {
  const store = createUserStore();
  const created = await createUserCore(
    validUserInput({ dailyReportTemplateType: null }),
    store.dependencies,
  );

  assert.equal(created.success, true);
  assert.equal(store.users[0].dailyReportTemplateType, null);
});

test("updateUserCore changes an existing user's daily report template assignment", async () => {
  const store = createUserStore([
    makeUser("user-1", { dailyReportTemplateType: "ASSISTANT" }),
  ]);
  const input: ValidatedUserUpdateInput = {
    userId: "user-1",
    ...validUserInput({ dailyReportTemplateType: "OPERATIONS_COORDINATOR" }),
  };

  await updateUserCore(input, "admin-1", store.dependencies);

  assert.equal(store.users[0].dailyReportTemplateType, "OPERATIONS_COORDINATOR");
});

test("deactivates rather than deleting a user", async () => {
  const store = createUserStore([makeUser("user-1")]);
  const result = await deactivateUserCore("user-1", "admin-1", store.dependencies);

  assert.equal(result.success, true);
  assert.equal(store.users.length, 1);
  assert.equal(store.users[0].active, false);
  assert.equal(
    (await getUserByIdCore("user-1", store.dependencies))?.id,
    "user-1",
  );
});

test("records a DEACTIVATED status activity, attributed to the acting admin, when deactivateUserCore flips an active user", async () => {
  const store = createUserStore([makeUser("user-1", { active: true })]);
  await deactivateUserCore("user-1", "admin-1", store.dependencies);

  assert.deepEqual(store.statusTransitions, [
    { userId: "user-1", type: "DEACTIVATED", actorUserId: "admin-1" },
  ]);
});

test("does not record a duplicate status activity when deactivating an already-inactive user", async () => {
  const store = createUserStore([makeUser("user-1", { active: false })]);
  const result = await deactivateUserCore("user-1", "admin-1", store.dependencies);

  assert.equal(result.success, true);
  assert.deepEqual(store.statusTransitions, []);
});

test("records an ACTIVATED status activity when updateUserCore flips an inactive user back on", async () => {
  const store = createUserStore([makeUser("user-1", { active: false })]);
  const input: ValidatedUserUpdateInput = {
    userId: "user-1",
    ...validUserInput({ active: true }),
  };

  await updateUserCore(input, "admin-2", store.dependencies);

  assert.deepEqual(store.statusTransitions, [
    { userId: "user-1", type: "ACTIVATED", actorUserId: "admin-2" },
  ]);
});

test("records no status activity when updateUserCore leaves active unchanged", async () => {
  const store = createUserStore([makeUser("user-1", { active: true })]);
  const input: ValidatedUserUpdateInput = {
    userId: "user-1",
    ...validUserInput({ active: true, firstName: "Renamed" }),
  };

  await updateUserCore(input, "admin-1", store.dependencies);

  assert.deepEqual(store.statusTransitions, []);
});

test("lists only active users when requested and sorts them by name", async () => {
  const store = createUserStore([
    makeUser("user-1", { firstName: "Zoé", lastName: "Kaboré" }),
    makeUser("user-2", {
      firstName: "Inactive",
      lastName: "Agent",
      active: false,
    }),
    makeUser("user-3", { firstName: "Awa", lastName: "Bazié" }),
  ]);
  const users = await listUsersCore({ active: true }, store.dependencies);

  assert.deepEqual(
    users.map((user) => user.id),
    ["user-3", "user-1"],
  );
});

test("updateOwnProfileCore updates first name, last name, and phone", async () => {
  const store = createUserStore([
    makeUser("user-1", {
      firstName: "Aminata",
      lastName: "Ouédraogo",
      phone: "70 12 34 56",
    }),
  ]);

  const result = await updateOwnProfileCore(
    "user-1",
    { firstName: "Mariam", lastName: "Traoré", phone: "78 90 12 34" },
    store.dependencies,
  );

  assert.equal(result.success, true);
  assert.equal(store.users[0].firstName, "Mariam");
  assert.equal(store.users[0].lastName, "Traoré");
  assert.equal(store.users[0].phone, "78 90 12 34");
});

test("updateOwnProfileCore never changes email, role, or active status", async () => {
  const store = createUserStore([
    makeUser("user-1", {
      email: "original@example.com",
      role: "COMMERCIAL",
      active: true,
    }),
  ]);

  await updateOwnProfileCore(
    "user-1",
    { firstName: "Mariam", lastName: "Traoré", phone: null },
    store.dependencies,
  );

  assert.equal(store.users[0].email, "original@example.com");
  assert.equal(store.users[0].role, "COMMERCIAL");
  assert.equal(store.users[0].active, true);
});

test("returns a controlled result when updating or deactivating an unknown user", async () => {
  const store = createUserStore();
  const updateResult = await updateUserCore(
    { userId: "missing", ...validUserInput() },
    "admin-1",
    store.dependencies,
  );
  const deactivateResult = await deactivateUserCore(
    "missing",
    "admin-1",
    store.dependencies,
  );

  assert.equal(updateResult.success, false);
  assert.equal(deactivateResult.success, false);
  if (!updateResult.success && !deactivateResult.success) {
    assert.equal(updateResult.code, "NOT_FOUND");
    assert.equal(deactivateResult.code, "NOT_FOUND");
  }
});

function createUserStore(initialUsers: User[] = []) {
  const users = initialUsers.map((user) => ({ ...user }));
  const statusTransitions: Array<
    { userId: string } & UserStatusTransition
  > = [];
  let nextId = users.length + 1;

  const dependencies: UserServiceDependencies = {
    create: async (data) => {
      const user = makeUser(`user-${nextId++}`, data);
      users.push(user);
      return { id: user.id };
    },
    update: async (userId, data, statusTransition) => {
      const user = users.find((item) => item.id === userId);
      if (!user) {
        throw new Error("Unknown user");
      }
      Object.assign(user, data, { updatedAt: new Date() });

      if (statusTransition) {
        statusTransitions.push({ userId, ...statusTransition });
      }

      return { id: user.id };
    },
    findById: async (userId) =>
      users.find((item) => item.id === userId) ?? null,
    list: async (filters) =>
      users.filter(
        (user) => filters.active === undefined || user.active === filters.active,
      ),
  };

  return { users, statusTransitions, dependencies };
}

function makeUser(
  id: string,
  overrides: Partial<User> = {},
): User {
  return {
    id,
    firstName: "Aminata",
    lastName: "Ouédraogo",
    email: "aminata@example.com",
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
