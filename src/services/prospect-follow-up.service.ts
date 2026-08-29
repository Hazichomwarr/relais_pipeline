import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";
import type { ValidatedProspectFollowUpWorkflowInput } from "@/src/lib/validations/prospect-follow-up.schema";
import type { AuthenticatedUser } from "@/src/services/authorization.service-core";
import { buildCommercialProspectByIdWhere } from "@/src/services/commercial-prospect.service-core";
import { submitProspectFollowUpCore } from "@/src/services/prospect-follow-up.service-core";

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

/**
 * Ownership scope for the whole follow-up (find + update) mirrors
 * createCommercialActivity: unscoped for ADMIN/MANAGER, owner-scoped for
 * COMMERCIAL via the same where-clause helper the rest of the commercial
 * surface uses — a foreign prospectId simply resolves to "not found".
 */
function buildProspectWhere(
  actor: AuthenticatedUser,
  prospectId: string,
): Prisma.ProspectWhereUniqueInput {
  return actor.role === "COMMERCIAL"
    ? buildCommercialProspectByIdWhere(prospectId, actor.id)
    : { id: prospectId };
}

export async function submitProspectFollowUp(
  actor: AuthenticatedUser,
  input: ValidatedProspectFollowUpWorkflowInput,
) {
  return submitProspectFollowUpCore(actor, input, {
    runTransaction: (work) =>
      prisma.$transaction((tx) =>
        work({
          findProspect: (id) =>
            tx.prospect.findUnique({
              where: buildProspectWhere(actor, id),
              select: {
                id: true,
                status: true,
                assignedUserId: true,
                assignedUser: {
                  select: { firstName: true, lastName: true, role: true },
                },
              },
            }),
          updateProspect: async (id, data) => {
            await tx.prospect.update({
              where: buildProspectWhere(actor, id),
              data,
            });
          },
          createActivity: (data) =>
            tx.prospectActivity.create({ data, select: { id: true } }),
          findById: (actionId) =>
            tx.prospectAction.findUnique({
              where: { id: actionId },
              select: actionSelect,
            }),
          completeAtomically: async (actionId, completedByUserId) => {
            const result = await tx.prospectAction.updateMany({
              where: { id: actionId, status: "OPEN" },
              data: {
                status: "COMPLETED",
                completedAt: new Date(),
                completedByUserId,
              },
            });
            return { count: result.count };
          },
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
        }),
      ),
  });
}
