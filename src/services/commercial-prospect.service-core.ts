import type { Prisma } from "@prisma/client";

import { buildProspectWhere } from "@/src/services/prospect-read.service-core";
import type { ProspectFilters } from "@/src/types/propect.-filters";

export type CommercialProspectFilters = Omit<ProspectFilters, "userId">;

export function buildCommercialProspectWhere(
  userId: string,
  filters: CommercialProspectFilters = {},
): Prisma.ProspectWhereInput {
  return buildProspectWhere({ ...filters, userId });
}

/**
 * Scopes a single-prospect lookup to its owner so a foreign or unknown
 * prospectId resolves to null from the query itself, never from a
 * post-fetch ownership check.
 */
export function buildCommercialProspectByIdWhere(
  prospectId: string,
  commercialId: string,
): Prisma.ProspectWhereUniqueInput {
  return { id: prospectId, assignedUserId: commercialId };
}
