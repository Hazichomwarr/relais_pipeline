import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";
import { buildSchoolDirectoryWhere } from "@/src/services/school-directory.service-core";
import {
  buildExactSchoolNameWhere,
  buildSchoolNameStartsWithWhere,
  findPossibleSchoolDuplicatesCore,
  MAX_POSSIBLE_SCHOOL_DUPLICATES,
} from "@/src/services/school-duplicate.service-core";

export const schoolDuplicateCandidateSelect = {
  id: true,
  name: true,
  location: true,
  status: true,
  interest: true,
  agentName: true,
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

function findCandidates(where: Prisma.ProspectWhereInput) {
  return prisma.prospect.findMany({
    where,
    select: schoolDuplicateCandidateSelect,
    orderBy: [{ updatedAt: "desc" }],
    take: MAX_POSSIBLE_SCHOOL_DUPLICATES,
  });
}

export async function findPossibleSchoolDuplicates(name: string) {
  return findPossibleSchoolDuplicatesCore(name, {
    findByExactName: (n) => findCandidates(buildExactSchoolNameWhere(n)),
    findByNameStartingWith: (n) =>
      findCandidates(buildSchoolNameStartsWithWhere(n)),
    findByNameContaining: (n) =>
      findCandidates(buildSchoolDirectoryWhere({ search: n })),
  });
}
