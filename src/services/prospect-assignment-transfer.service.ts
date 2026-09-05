import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";
import type { ValidatedReassignProspectInput } from "@/src/lib/validations/prospect-assignment-transfer.schema";
import { reassignProspectCore } from "@/src/services/prospect-assignment-transfer.service-core";

const actorLookupSelect = {
  id: true,
  active: true,
  role: true,
} satisfies Prisma.UserSelect;

/**
 * Ticket 28B — the ownership change and the transfer-history insert
 * happen in one transaction: either both commit or neither does. The
 * conditional `updateMany` below is the concurrency guard (28A §29,
 * 28B §28-30) — `assignedUserId: expectedCurrentOwnerId` is passed
 * literally, never conditionally spread away, so a `null` current owner
 * still produces a correct `WHERE "assignedUserId" IS NULL` guard rather
 * than silently becoming an unguarded write.
 */
export async function reassignProspect(
  actorId: string,
  input: ValidatedReassignProspectInput,
) {
  return prisma.$transaction((tx) =>
    reassignProspectCore(actorId, input, {
      findActor: (id) =>
        tx.user.findUnique({ where: { id }, select: actorLookupSelect }),
      findProspect: (id) =>
        tx.prospect.findUnique({
          where: { id },
          select: { id: true, assignedUserId: true },
        }),
      findTarget: (id) =>
        tx.user.findUnique({ where: { id }, select: actorLookupSelect }),
      reassignAtomically: async (
        prospectId,
        expectedCurrentOwnerId,
        newAssignedUserId,
      ) => {
        const result = await tx.prospect.updateMany({
          where: {
            id: prospectId,
            assignedUserId: expectedCurrentOwnerId,
          },
          data: { assignedUserId: newAssignedUserId },
        });
        return { count: result.count };
      },
      recordTransfer: (fields) =>
        tx.prospectAssignmentTransfer.create({
          data: fields,
          select: { id: true },
        }),
    }),
  );
}

const transferWithUsersSelect = {
  id: true,
  prospectId: true,
  fromUserId: true,
  fromUser: { select: { id: true, firstName: true, lastName: true } },
  toUserId: true,
  toUser: { select: { id: true, firstName: true, lastName: true } },
  changedByUserId: true,
  changedByUser: { select: { id: true, firstName: true, lastName: true } },
  reason: true,
  occurredAt: true,
} satisfies Prisma.ProspectAssignmentTransferSelect;

/**
 * Ticket 28B §41/§42 — a clean read primitive for 28C, deliberately
 * unscoped by role here: this file only reads what it's given. The
 * caller (28C's route/action) MUST gate this behind
 * requireProspectReassignmentAccess() (or an equivalent ADMIN/MANAGER-only
 * check) before rendering `reason` to anyone — COMMERCIAL and ASSISTANT
 * must never reach a read that exposes management transfer reasons.
 * Newest first, matching every other durable-history read in this schema
 * (ProspectActivity, UserStatusActivity).
 */
export async function getProspectAssignmentTransfers(prospectId: string) {
  return prisma.prospectAssignmentTransfer.findMany({
    where: { prospectId },
    select: transferWithUsersSelect,
    orderBy: { occurredAt: "desc" },
  });
}

export type ProspectAssignmentTransferListItem = Awaited<
  ReturnType<typeof getProspectAssignmentTransfers>
>[number];
