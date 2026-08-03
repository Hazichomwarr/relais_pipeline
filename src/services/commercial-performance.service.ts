import "server-only";

import { prisma } from "@/src/lib/prisma";
import { startOfCalendarDay } from "@/src/lib/follow-up-presentation";
import { assertCommercialAccess } from "@/src/services/commercial-access.service";
import { presentCommercialPerformance } from "@/src/services/commercial-performance.service-core";
import { buildFollowUpQueueWhere } from "@/src/services/follow-up.service-core";

export async function getCommercialPerformance(
  userId: string,
  today = new Date(),
) {
  const commercial = await assertCommercialAccess(userId);
  return queryCommercialPerformance(commercial.id, today);
}

export async function queryCommercialPerformance(
  userId: string,
  today = new Date(),
) {
  const scopedWhere = { assignedUserId: userId } as const;

  const [statusGroups, followUpsToday, overdueProspects, readyToDiscuss] =
    await Promise.all([
      prisma.prospect.groupBy({
        by: ["status"],
        where: scopedWhere,
        _count: { _all: true },
      }),
      prisma.prospect.count({
        where: buildFollowUpQueueWhere({ userId }, today),
      }),
      prisma.prospect.count({
        where: {
          ...scopedWhere,
          status: { notIn: ["WON", "LOST"] },
          followUpDate: { lt: startOfCalendarDay(today) },
        },
      }),
      prisma.prospect.count({
        where: {
          ...scopedWhere,
          interest: "READY_TO_DISCUSS",
        },
      }),
    ]);

  return presentCommercialPerformance({
    statusCounts: statusGroups.map((group) => ({
      status: group.status,
      count: group._count._all,
    })),
    followUpsToday,
    overdueProspects,
    readyToDiscuss,
  });
}
