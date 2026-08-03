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
