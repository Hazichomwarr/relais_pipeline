import "server-only";

import { prisma } from "@/src/lib/prisma";
import { assertCommercialAccess } from "@/src/services/commercial-access.service";
import {
  buildCommercialProspectWhere,
  type CommercialProspectFilters,
} from "@/src/services/commercial-prospect.service-core";
import {
  assignedUserListSelect,
  prospectListOrderBy,
} from "@/src/services/prospect-read.service-core";

export async function getCommercialProspects(
  userId: string,
  filters: CommercialProspectFilters = {},
) {
  const commercial = await assertCommercialAccess(userId);

  return prisma.prospect.findMany({
    where: buildCommercialProspectWhere(commercial.id, filters),
    include: {
      assignedUser: { select: assignedUserListSelect },
    },
    orderBy: prospectListOrderBy,
  });
}

export type CommercialProspectListItem = Awaited<
  ReturnType<typeof getCommercialProspects>
>[number];
