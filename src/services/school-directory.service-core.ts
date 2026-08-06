import type { InterestLevel, ProspectStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

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
    lastActivityAt: row.activities.at(0)?.occurredAt ?? null,
  };
}
