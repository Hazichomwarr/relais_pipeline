import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";
import {
  buildSchoolDirectoryWhere,
  presentSchoolDirectoryItem,
  schoolDirectoryOrderBy,
  type SchoolDirectoryFilters,
} from "@/src/services/school-directory.service-core";

export const schoolDirectorySelect = {
  id: true,
  name: true,
  status: true,
  interest: true,
  agentName: true,
  assignedUserId: true,
  assignedUser: {
    select: {
      firstName: true,
      lastName: true,
    },
  },
  activities: {
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: 1,
    select: { occurredAt: true },
  },
} satisfies Prisma.ProspectSelect;

export async function listSchools(filters: SchoolDirectoryFilters = {}) {
  const rows = await prisma.prospect.findMany({
    where: buildSchoolDirectoryWhere(filters),
    select: schoolDirectorySelect,
    orderBy: schoolDirectoryOrderBy,
  });

  return rows.map(presentSchoolDirectoryItem);
}

export type SchoolDirectoryItem = Awaited<
  ReturnType<typeof listSchools>
>[number];

/**
 * Scoped to product: "KARMDA" so a non-school prospect id resolves to null
 * here even if it exists — this route only ever shows schools.
 */
export async function getSchoolSummaryById(prospectId: string) {
  const row = await prisma.prospect.findFirst({
    where: { id: prospectId, product: "KARMDA" },
    select: schoolDirectorySelect,
  });

  return row ? presentSchoolDirectoryItem(row) : null;
}

export type SchoolSummary = NonNullable<
  Awaited<ReturnType<typeof getSchoolSummaryById>>
>;
