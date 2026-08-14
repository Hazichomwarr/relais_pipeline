import "server-only";

import { prisma } from "@/src/lib/prisma";
import type { ValidatedProspectActivityInput } from "@/src/lib/validations/prospect-activity.schema";
import { assertCommercialAccess } from "@/src/services/commercial-access.service";
import {
  buildCommercialProspectByIdWhere,
  buildCommercialProspectWhere,
  type CommercialProspectFilters,
} from "@/src/services/commercial-prospect.service-core";
import { createProspectActivityCore } from "@/src/services/prospect-activity.service-core";
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

export async function getCommercialProspectById(
  userId: string,
  prospectId: string,
) {
  const commercial = await assertCommercialAccess(userId);

  return prisma.prospect.findFirst({
    where: buildCommercialProspectByIdWhere(prospectId, commercial.id),
    include: {
      assignedUser: { select: assignedUserListSelect },
    },
  });
}

export type CommercialProspectDetail = NonNullable<
  Awaited<ReturnType<typeof getCommercialProspectById>>
>;

export async function createCommercialActivity(
  userId: string,
  input: ValidatedProspectActivityInput,
) {
  const commercial = await assertCommercialAccess(userId);

  return createProspectActivityCore(input, commercial, {
    runTransaction: (work) =>
      prisma.$transaction((transaction) =>
        work({
          findProspect: (id) =>
            transaction.prospect.findFirst({
              where: buildCommercialProspectByIdWhere(id, commercial.id),
              select: { id: true },
            }),
          createActivity: (data) =>
            transaction.prospectActivity.create({
              data,
              select: { id: true },
            }),
        }),
      ),
  });
}
