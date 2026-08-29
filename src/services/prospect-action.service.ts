import "server-only";

import type { Prisma, UserRole } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";
import type {
  ValidatedCreateProspectActionInput,
} from "@/src/lib/validations/prospect-action.schema";
import { buildCommercialProspectByIdWhere } from "@/src/services/commercial-prospect.service-core";
import {
  cancelProspectActionCore,
  completeProspectActionCore,
  compareProspectActionsForListing,
  createProspectActionWithAutoProgressionCore,
  type ProspectActionActor,
} from "@/src/services/prospect-action.service-core";

const actionSelect = {
  id: true,
  prospectId: true,
  assignedToUserId: true,
  createdByUserId: true,
  status: true,
  title: true,
  description: true,
  dueAt: true,
  completedAt: true,
  completedByUserId: true,
  canceledAt: true,
  canceledByUserId: true,
  cancellationReason: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProspectActionSelect;

const actionWithActorsSelect = {
  ...actionSelect,
  assignedToUser: {
    select: { id: true, firstName: true, lastName: true, active: true },
  },
  createdByUser: { select: { firstName: true, lastName: true } },
  completedByUser: { select: { firstName: true, lastName: true } },
  canceledByUser: { select: { firstName: true, lastName: true } },
} satisfies Prisma.ProspectActionSelect;

async function completeAtomically(actionId: string, completedByUserId: string) {
  const result = await prisma.prospectAction.updateMany({
    where: { id: actionId, status: "OPEN" },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      completedByUserId,
    },
  });

  return { count: result.count };
}

async function cancelAtomically(
  actionId: string,
  canceledByUserId: string,
  reason: string,
) {
  const result = await prisma.prospectAction.updateMany({
    where: { id: actionId, status: "OPEN" },
    data: {
      status: "CANCELED",
      canceledAt: new Date(),
      canceledByUserId,
      cancellationReason: reason,
    },
  });

  return { count: result.count };
}

/**
 * Ownership scope for creation is resolved from the authenticated actor's
 * role alone (never client input): ADMIN/MANAGER may create on any
 * prospect, COMMERCIAL only on a prospect they own — enforced by which
 * `findProspect` query runs, exactly like createCommercialActivity.
 *
 * Ticket 22D — wrapped in a transaction because a successful creation may
 * also progress a still-NEW prospect to TO_FOLLOW_UP: the action write and
 * the conditional status write must commit or roll back together (a
 * failed status guard must not leave an orphaned action, and a failed
 * action must never touch prospect status at all).
 */
export async function createProspectAction(
  actor: { id: string; role: UserRole },
  input: ValidatedCreateProspectActionInput,
) {
  return prisma.$transaction((tx) => {
    const findProspect =
      actor.role === "COMMERCIAL"
        ? (id: string) =>
            tx.prospect.findFirst({
              where: buildCommercialProspectByIdWhere(id, actor.id),
              select: { id: true, status: true },
            })
        : (id: string) =>
            tx.prospect.findUnique({
              where: { id },
              select: { id: true, status: true },
            });

    return createProspectActionWithAutoProgressionCore(actor.id, input, {
      findProspect,
      findAssignee: (userId) =>
        tx.user.findUnique({
          where: { id: userId },
          select: { id: true, active: true, role: true },
        }),
      create: (createdByUserId, fields) =>
        tx.prospectAction.create({
          data: { ...fields, createdByUserId },
          select: { id: true },
        }),
      progressNewProspectToFollowUp: async (prospectId) => {
        const result = await tx.prospect.updateMany({
          where:
            actor.role === "COMMERCIAL"
              ? {
                  ...buildCommercialProspectByIdWhere(prospectId, actor.id),
                  status: "NEW",
                }
              : { id: prospectId, status: "NEW" },
          data: { status: "TO_FOLLOW_UP" },
        });
        return { count: result.count };
      },
    });
  });
}

export async function completeProspectAction(
  actor: ProspectActionActor,
  actionId: string,
) {
  return completeProspectActionCore(actor, actionId, {
    findById: (id) =>
      prisma.prospectAction.findUnique({ where: { id }, select: actionSelect }),
    completeAtomically,
  });
}

export async function cancelProspectAction(
  actor: ProspectActionActor,
  actionId: string,
  reason: string,
) {
  return cancelProspectActionCore(actor, actionId, reason, {
    findById: (id) =>
      prisma.prospectAction.findUnique({ where: { id }, select: actionSelect }),
    cancelAtomically,
  });
}

/**
 * Unscoped by caller role — mirrors getProspectActivities: the page that
 * calls this has already resolved (and ownership-checked) the prospect
 * itself via getProspectById / getCommercialProspectById, so this read
 * inherits that boundary rather than re-implementing it.
 */
export async function listProspectActionsForProspect(prospectId: string) {
  const actions = await prisma.prospectAction.findMany({
    where: { prospectId },
    select: actionWithActorsSelect,
  });

  return [...actions].sort(compareProspectActionsForListing);
}

export type ProspectActionListItem = Awaited<
  ReturnType<typeof listProspectActionsForProspect>
>[number];
