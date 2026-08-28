import "server-only";

import { prisma } from "@/src/lib/prisma";
import type { AuthenticatedUser } from "@/src/services/authorization.service-core";
import type { ValidatedCreateCommercialPerformanceTargetInput } from "@/src/lib/validations/commercial-performance-target.schema";
import {
  createCommercialPerformanceTargetCore,
  deleteCommercialPerformanceTargetCore,
  getCommercialPerformanceTargetCore,
  isCommercialPerformanceTargetPeriodLocked,
  resolveCommercialPerformanceTargetPeriod,
  updateCommercialPerformanceTargetCore,
  type CommercialPerformanceTargetPeriod,
} from "@/src/services/commercial-performance-target.service-core";

export async function createCommercialPerformanceTarget(
  actor: AuthenticatedUser,
  input: ValidatedCreateCommercialPerformanceTargetInput,
) {
  return createCommercialPerformanceTargetCore(
    actor,
    { userId: input.userId, month: { year: input.year, month: input.month }, targetWins: input.targetWins },
    {
      findEmployee: (userId) =>
        prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, role: true, active: true },
        }),
      findExisting: (userId, periodStart, periodEnd) =>
        prisma.commercialPerformanceTarget.findUnique({
          where: {
            userId_periodStart_periodEnd: { userId, periodStart, periodEnd },
          },
          select: { id: true },
        }),
      create: (fields) =>
        prisma.commercialPerformanceTarget.create({
          data: fields,
          select: { id: true },
        }),
    },
  );
}

export async function updateCommercialPerformanceTarget(
  actor: AuthenticatedUser,
  targetId: string,
  targetWins: number,
) {
  return updateCommercialPerformanceTargetCore(actor, targetId, targetWins, {
    findById: (id) =>
      prisma.commercialPerformanceTarget.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          periodStart: true,
          periodEnd: true,
          targetWins: true,
          roleAtAssignment: true,
        },
      }),
    update: async (id, wins) => {
      await prisma.commercialPerformanceTarget.update({
        where: { id },
        data: { targetWins: wins },
      });
    },
  });
}

export async function deleteCommercialPerformanceTarget(
  actor: AuthenticatedUser,
  targetId: string,
) {
  return deleteCommercialPerformanceTargetCore(actor, targetId, {
    findById: (id) =>
      prisma.commercialPerformanceTarget.findUnique({
        where: { id },
        select: { id: true, periodStart: true },
      }),
    delete: async (id) => {
      await prisma.commercialPerformanceTarget.delete({ where: { id } });
    },
  });
}

/** Exact-period lookup only (Ticket 25H.2A §31) — the future Results-scoring entrypoint. */
export async function getCommercialPerformanceTarget(
  userId: string,
  period: CommercialPerformanceTargetPeriod,
) {
  return getCommercialPerformanceTargetCore(userId, period, {
    findExact: (id, periodStart, periodEnd) =>
      prisma.commercialPerformanceTarget.findUnique({
        where: {
          userId_periodStart_periodEnd: {
            userId: id,
            periodStart,
            periodEnd,
          },
        },
        select: {
          id: true,
          userId: true,
          periodStart: true,
          periodEnd: true,
          targetWins: true,
          roleAtAssignment: true,
        },
      }),
  });
}

/**
 * Management listing for the small admin surface (Ticket 25H.2A §40) —
 * every target, newest period first, with `locked` derived at read time
 * (never persisted — see isCommercialPerformanceTargetPeriodLocked's own
 * comment on why lock state is always computed, not stored).
 */
export async function listCommercialPerformanceTargetsForManagement(
  now: Date = new Date(),
) {
  const targets = await prisma.commercialPerformanceTarget.findMany({
    orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      targetWins: true,
      roleAtAssignment: true,
      user: { select: { id: true, firstName: true, lastName: true } },
      createdByUser: { select: { firstName: true, lastName: true } },
      createdAt: true,
    },
  });

  return targets.map((target) => ({
    ...target,
    locked: isCommercialPerformanceTargetPeriodLocked(
      target.periodStart,
      now,
    ),
  }));
}

export { resolveCommercialPerformanceTargetPeriod };

export type CommercialPerformanceTargetListItem = Awaited<
  ReturnType<typeof listCommercialPerformanceTargetsForManagement>
>[number];
