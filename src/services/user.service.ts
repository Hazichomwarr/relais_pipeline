import "server-only";

import type { UserRole } from "@prisma/client";

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
import { createUserWithCreationHistory } from "@/src/services/user-creation-history.service";
import { resolveRelaisOrganizationId } from "@/src/services/organization-bootstrap.service";
import { PROSPECT_ACTION_ASSIGNEE_ROLES } from "@/src/services/prospect-action.service-core";
import { PROSPECT_OWNER_ROLES } from "@/src/services/prospect-creation.service-core";
import { COMMERCIAL_PERFORMANCE_TARGET_ELIGIBLE_ROLES } from "@/src/services/commercial-performance-target.service-core";

const dependencies = {
  create: (data: ValidatedUserInput, actorUserId: string) =>
    createUserWithCreationHistory(data, actorUserId),
  update: (
    userId: string,
    data: Parameters<typeof prisma.user.update>[0]["data"],
    statusTransition?: UserStatusTransition,
  ) => {
    // Ticket 26B §42/§47: role editing still mutates User.role directly
    // (runtime authority, unchanged), but the same transaction now also
    // keeps the RELAIS OrganizationMembership shadow role synchronized —
    // never left stale — so this is the "existing role-change mutation"
    // the ticket requires updating, not a new authority switch.
    const nextRole = data.role as UserRole | undefined;

    if (!statusTransition && nextRole === undefined) {
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

      if (statusTransition) {
        await transaction.userStatusActivity.create({
          data: {
            userId,
            type: statusTransition.type,
            actorUserId: statusTransition.actorUserId,
          },
        });
      }

      if (nextRole !== undefined) {
        const organizationId = await resolveRelaisOrganizationId(transaction);
        await transaction.organizationMembership.update({
          where: { organizationId_userId: { organizationId, userId } },
          data: { role: nextRole },
        });
      }

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

export async function createUser(
  input: ValidatedUserInput,
  actorUserId: string,
) {
  return createUserCore(input, actorUserId, dependencies);
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
 * Ticket 20B — any active User in one of the commercial-workflow roles
 * can receive a ProspectAction (see the domain-map comment on `model
 * ProspectAction`). Ticket 25M §14/§17: narrowed from an unconditional
 * "any active User" to PROSPECT_ACTION_ASSIGNEE_ROLES — same value set
 * as every pre-25M role, so this changes nothing for ADMIN/MANAGER/
 * COMMERCIAL; it only keeps the new ASSISTANT role out of this dropdown,
 * centralizing the rule here rather than filtering client-side.
 * Deliberately not `listAssignableUsers`, whose COMMERCIAL-only filter is
 * specific to Commercial prospect assignment, an unrelated concept.
 */
export async function listActiveUsersForTaskAssignment() {
  return prisma.user.findMany({
    where: { active: true, role: { in: [...PROSPECT_ACTION_ASSIGNEE_ROLES] } },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  });
}

/**
 * Ticket 28C — populates the reassignment target picker. Deliberately its
 * own query filtered by PROSPECT_OWNER_ROLES (the same constant
 * canReceiveProspectAssignment/28B composes with `active`), not reused
 * from listActiveUsersForTaskAssignment above even though the value set
 * is identical today — ProspectAction-assignee eligibility and
 * prospect-reassignment-target eligibility are different domain
 * decisions that only coincide by value right now (same reasoning
 * documented on listCommercialResultsTargetEligibleUsers below). This is
 * presentation only — reassignProspectCore remains the sole
 * authoritative eligibility check; a stale/crafted client value is
 * rejected there regardless of what this list ever returned.
 */
export async function listProspectReassignmentEligibleUsers() {
  return prisma.user.findMany({
    where: { active: true, role: { in: [...PROSPECT_OWNER_ROLES] } },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  });
}

/**
 * Ticket 25P §11/§34 — target-subject eligibility (COMMERCIAL, MANAGER),
 * used to populate the target-creation employee dropdown. Deliberately
 * not `listAssignableUsers` (COMMERCIAL-only, a distinct "Commercial
 * prospect assignment" concept — 25P §42 leaves that policy untouched)
 * and not `listActiveUsersForTaskAssignment` (ProspectAction assignee
 * eligibility, also a distinct policy) — this filters by its own
 * exported role constant so the dropdown can never silently drift from
 * server-side eligibility.
 */
export async function listCommercialResultsTargetEligibleUsers() {
  return prisma.user.findMany({
    where: {
      active: true,
      role: { in: [...COMMERCIAL_PERFORMANCE_TARGET_ELIGIBLE_ROLES] },
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
export type CommercialResultsTargetEligibleUser = Awaited<
  ReturnType<typeof listCommercialResultsTargetEligibleUsers>
>[number];
