import "server-only";

import { prisma } from "@/src/lib/prisma";
import type {
  ValidatedCommercialProfileUpdateInput,
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
  type UserListFilters,
  type UserStatusTransition,
} from "@/src/services/user.service-core";

const dependencies = {
  create: (data: ValidatedUserInput) =>
    prisma.user.create({ data, select: { id: true } }),
  update: (
    userId: string,
    data: Parameters<typeof prisma.user.update>[0]["data"],
    statusTransition?: UserStatusTransition,
  ) => {
    if (!statusTransition) {
      return prisma.user.update({
        where: { id: userId },
        data,
        select: { id: true },
      });
    }

    return prisma.$transaction(async (transaction) => {
      const user = await transaction.user.update({
        where: { id: userId },
        data,
        select: { id: true },
      });

      await transaction.userStatusActivity.create({
        data: {
          userId,
          type: statusTransition.type,
          actorUserId: statusTransition.actorUserId,
        },
      });

      return user;
    });
  },
  findById: (userId: string) =>
    prisma.user.findUnique({ where: { id: userId } }),
  list: (filters: UserListFilters) =>
    prisma.user.findMany({
      where: filters.active === undefined ? undefined : { active: filters.active },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
};

export async function createUser(input: ValidatedUserInput) {
  return createUserCore(input, dependencies);
}

export async function updateUser(
  input: ValidatedUserUpdateInput,
  actorUserId: string,
) {
  return updateUserCore(input, actorUserId, dependencies);
}

export async function updateOwnProfile(
  userId: string,
  input: ValidatedCommercialProfileUpdateInput,
) {
  return updateOwnProfileCore(userId, input, dependencies);
}

export async function listUsers(filters: UserListFilters = {}) {
  return listUsersCore(filters, dependencies);
}

export async function getUserById(userId: string) {
  return getUserByIdCore(userId, dependencies);
}

export async function deactivateUser(userId: string, actorUserId: string) {
  return deactivateUserCore(userId, actorUserId, dependencies);
}

export async function listAssignableUsers() {
  return prisma.user.findMany({
    where: {
      active: true,
      role: "COMMERCIAL",
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
  });
}

export async function listDashboardUserOptions() {
  return prisma.user.findMany({
    where: {
      OR: [
        { active: true, role: "COMMERCIAL" },
        { assignedProspects: { some: {} } },
      ],
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
      active: true,
    },
  });
}

/**
 * Ticket 20B — role-neutral by design (any active User can receive a
 * ProspectAction; see the domain-map comment on `model ProspectAction`).
 * Deliberately not `listAssignableUsers`, whose COMMERCIAL-only filter is
 * specific to Commercial prospect assignment, an unrelated concept.
 */
export async function listActiveUsersForTaskAssignment() {
  return prisma.user.findMany({
    where: { active: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  });
}

export type UserListItem = Awaited<ReturnType<typeof listUsers>>[number];
export type AssignableUser = Awaited<
  ReturnType<typeof listAssignableUsers>
>[number];
export type DashboardUserOption = Awaited<
  ReturnType<typeof listDashboardUserOptions>
>[number];
export type ActiveUserForTaskAssignment = Awaited<
  ReturnType<typeof listActiveUsersForTaskAssignment>
>[number];
