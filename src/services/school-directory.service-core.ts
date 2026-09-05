import type { InterestLevel, ProspectStatus, UserRole } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { getResponsibleUserDisplay } from "@/src/lib/prospect-responsible-display";

export type SchoolDirectoryFilters = {
  search?: string;
};

export const schoolDirectoryOrderBy = [
  { name: "asc" },
] satisfies Prisma.ProspectOrderByWithRelationInput[];

/**
 * A "school" is a KARMDA prospect — the only RELAIS product about school
 * management. Search is deliberately name-only (never contactName/phone/
 * location, unlike buildProspectWhere) since this directory only answers
 * "has this school already been prospected?".
 */
export function buildSchoolDirectoryWhere(
  filters: SchoolDirectoryFilters = {},
): Prisma.ProspectWhereInput {
  const where: Prisma.ProspectWhereInput = { product: "KARMDA" };

  const search = filters.search?.trim();
  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  return where;
}

export type SchoolDirectoryRow = {
  id: string;
  name: string;
  status: ProspectStatus;
  interest: InterestLevel;
  agentName: string;
  assignedUserId: string | null;
  assignedUser: {
    firstName: string;
    lastName: string;
    role: UserRole;
    active: boolean;
  } | null;
  activities: Array<{ occurredAt: Date }>;
};

export function presentSchoolDirectoryItem(row: SchoolDirectoryRow) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    interest: row.interest,
    assignedUserId: row.assignedUserId,
    commercialName: row.assignedUser
      ? `${row.assignedUser.firstName} ${row.assignedUser.lastName}`
      : row.agentName,
    // Ticket 28C — kept alongside commercialName above (unaffected, still
    // used by the directory cards) rather than replacing it: this is the
    // truthful "Responsable du suivi" representation used by the
    // read-only summary page, which — unlike commercialName — never
    // falls back to the legacy agentName text for a genuinely unassigned
    // school.
    responsible: getResponsibleUserDisplay({
      assignedUserId: row.assignedUserId,
      assignedUser: row.assignedUser,
    }),
    lastActivityAt: row.activities.at(0)?.occurredAt ?? null,
  };
}
