import "server-only";

import { prisma } from "@/src/lib/prisma";
import { getCommercialDashboardCore } from "@/src/services/commercial-dashboard.service-core";
import { queryCommercialPerformance } from "@/src/services/commercial-performance.service";
import { getFollowUpQueue } from "@/src/services/follow-up.service";
import {
  assignedUserListSelect,
  buildProspectWhere,
  prospectListOrderBy,
} from "@/src/services/prospect-read.service-core";

export async function getCommercialDashboard(
  userId: string,
  today = new Date(),
) {
  return getCommercialDashboardCore(userId, today, {
    findCommercial: (validatedUserId) =>
      prisma.user.findUnique({
        where: { id: validatedUserId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          active: true,
        },
      }),
    getPerformance: queryCommercialPerformance,
    getFollowUps: (commercialId, currentDay) =>
      getFollowUpQueue({ userId: commercialId }, currentDay),
    getRecentProspects: (commercialId) =>
      prisma.prospect.findMany({
        where: buildProspectWhere({ userId: commercialId }),
        include: {
          assignedUser: { select: assignedUserListSelect },
        },
        orderBy: prospectListOrderBy,
        take: 10,
      }),
  });
}

export type CommercialDashboard = Awaited<
  ReturnType<typeof getCommercialDashboard>
>;
