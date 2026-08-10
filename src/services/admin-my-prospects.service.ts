import "server-only";

import { prisma } from "@/src/lib/prisma";
import {
  buildAdminMyProspectsWhere,
  type AdminMyProspectsFilters,
} from "@/src/services/admin-my-prospects.service-core";
import {
  assignedUserListSelect,
  prospectListOrderBy,
} from "@/src/services/prospect-read.service-core";

export async function getAdminMyProspects(
  adminId: string,
  filters: AdminMyProspectsFilters = {},
) {
  return prisma.prospect.findMany({
    where: buildAdminMyProspectsWhere(adminId, filters),
    include: {
      assignedUser: { select: assignedUserListSelect },
    },
    orderBy: prospectListOrderBy,
  });
}

export type AdminMyProspectListItem = Awaited<
  ReturnType<typeof getAdminMyProspects>
>[number];

export type AdminMyProspectsKpis = {
  total: number;
  toFollowUp: number;
  won: number;
};

/**
 * V1 KPI set kept intentionally compact (Ticket 15H.2) — reuses existing
 * ProspectStatus semantics rather than inventing new business definitions:
 * TO_FOLLOW_UP is already the literal "À suivre" status, so "à suivre"
 * means exactly that status, not "any non-terminal status."
 */
export async function getAdminMyProspectsKpis(
  adminId: string,
): Promise<AdminMyProspectsKpis> {
  const [total, toFollowUp, won] = await Promise.all([
    prisma.prospect.count({ where: { assignedUserId: adminId } }),
    prisma.prospect.count({
      where: { assignedUserId: adminId, status: "TO_FOLLOW_UP" },
    }),
    prisma.prospect.count({
      where: { assignedUserId: adminId, status: "WON" },
    }),
  ]);

  return { total, toFollowUp, won };
}
