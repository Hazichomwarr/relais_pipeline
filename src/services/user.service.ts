import "server-only";

import { prisma } from "@/src/lib/prisma";
import type {
  ValidatedUserInput,
  ValidatedUserUpdateInput,
} from "@/src/lib/validations/user.schema";
import {
  createUserCore,
  deactivateUserCore,
  getUserByIdCore,
  listUsersCore,
  updateUserCore,
  type UserListFilters,
} from "@/src/services/user.service-core";

const dependencies = {
  create: (data: ValidatedUserInput) =>
    prisma.user.create({ data, select: { id: true } }),
  update: (
    userId: string,
    data: Parameters<typeof prisma.user.update>[0]["data"],
  ) => prisma.user.update({ where: { id: userId }, data, select: { id: true } }),
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

export async function updateUser(input: ValidatedUserUpdateInput) {
  return updateUserCore(input, dependencies);
}

export async function listUsers(filters: UserListFilters = {}) {
  return listUsersCore(filters, dependencies);
}

export async function getUserById(userId: string) {
  return getUserByIdCore(userId, dependencies);
}

export async function deactivateUser(userId: string) {
  return deactivateUserCore(userId, dependencies);
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

export type UserListItem = Awaited<ReturnType<typeof listUsers>>[number];
export type AssignableUser = Awaited<
  ReturnType<typeof listAssignableUsers>
>[number];
export type DashboardUserOption = Awaited<
  ReturnType<typeof listDashboardUserOptions>
>[number];
