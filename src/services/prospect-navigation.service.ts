import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";
import {
  buildNextProspectWhere,
  buildPreviousProspectWhere,
  getAdjacentProspectsCore,
  nextProspectOrderBy,
  previousProspectOrderBy,
  type CurrentProspectForNavigation,
} from "@/src/services/prospect-navigation.service-core";

const adjacentProspectSelect = {
  id: true,
  name: true,
} satisfies Prisma.ProspectSelect;

export async function getAdjacentProspects(
  current: CurrentProspectForNavigation,
) {
  return getAdjacentProspectsCore(current, {
    findPrevious: (scoped) =>
      prisma.prospect.findFirst({
        where: buildPreviousProspectWhere(scoped),
        orderBy: previousProspectOrderBy,
        select: adjacentProspectSelect,
      }),
    findNext: (scoped) =>
      prisma.prospect.findFirst({
        where: buildNextProspectWhere(scoped),
        orderBy: nextProspectOrderBy,
        select: adjacentProspectSelect,
      }),
  });
}
