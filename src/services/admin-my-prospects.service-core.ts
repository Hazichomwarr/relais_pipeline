import type { Prisma } from "@prisma/client";

import { buildProspectWhere } from "@/src/services/prospect-read.service-core";
import type { ProspectFilters } from "@/src/types/propect.-filters";

/**
 * Mirrors CommercialProspectFilters (Ticket 15H.1) — userId is never a
 * client-supplied filter, only the authenticated Admin's own id, forced in
 * below. This is a read-boundary distinction, not a role check: ADMIN's
 * authorization already permits reading every prospect, but this query's
 * scope is "prospects I personally own," not "prospects I may read."
 */
export type AdminMyProspectsFilters = Omit<ProspectFilters, "userId">;

export function buildAdminMyProspectsWhere(
  adminId: string,
  filters: AdminMyProspectsFilters = {},
): Prisma.ProspectWhereInput {
  return buildProspectWhere({ ...filters, userId: adminId });
}
