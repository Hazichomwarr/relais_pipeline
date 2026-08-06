import type { InterestLevel, Prisma, ProspectStatus } from "@prisma/client";

import { isSearchableSchoolName } from "@/src/lib/school-name-normalization";

export const MAX_POSSIBLE_SCHOOL_DUPLICATES = 5;

export type PossibleSchoolDuplicate = {
  id: string;
  name: string;
  location: string | null;
  assignedUserName: string;
  status: ProspectStatus;
  interest: InterestLevel;
  lastContactAt: Date | null;
};

export type SchoolDuplicateCandidateRow = {
  id: string;
  name: string;
  location: string | null;
  status: ProspectStatus;
  interest: InterestLevel;
  agentName: string;
  assignedUser: {
    firstName: string;
    lastName: string;
  } | null;
  activities: Array<{ occurredAt: Date }>;
};

export function buildExactSchoolNameWhere(
  name: string,
): Prisma.ProspectWhereInput {
  return {
    product: "KARMDA",
    name: { equals: name.trim(), mode: "insensitive" },
  };
}

export function buildSchoolNameStartsWithWhere(
  name: string,
): Prisma.ProspectWhereInput {
  return {
    product: "KARMDA",
    name: { startsWith: name.trim(), mode: "insensitive" },
  };
}

export function presentPossibleSchoolDuplicate(
  row: SchoolDuplicateCandidateRow,
): PossibleSchoolDuplicate {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    assignedUserName: row.assignedUser
      ? `${row.assignedUser.firstName} ${row.assignedUser.lastName}`
      : row.agentName,
    status: row.status,
    interest: row.interest,
    lastContactAt: row.activities.at(0)?.occurredAt ?? null,
  };
}

export type FindPossibleSchoolDuplicatesDependencies = {
  findByExactName: (name: string) => Promise<SchoolDuplicateCandidateRow[]>;
  findByNameStartingWith: (
    name: string,
  ) => Promise<SchoolDuplicateCandidateRow[]>;
  findByNameContaining: (
    name: string,
  ) => Promise<SchoolDuplicateCandidateRow[]>;
};

/**
 * Runs three deterministic tiers in order — exact, starts-with, contains —
 * short-circuiting once enough unique matches are collected. This gives an
 * exact-match-first / starts-with-next / contains-last ranking without
 * fetching an arbitrary pool and re-sorting it, so a true exact match is
 * never hidden behind a large "contains" result set on a big table.
 */
export async function findPossibleSchoolDuplicatesCore(
  rawName: string,
  dependencies: FindPossibleSchoolDuplicatesDependencies,
): Promise<PossibleSchoolDuplicate[]> {
  if (!isSearchableSchoolName(rawName)) {
    return [];
  }

  const trimmedName = rawName.trim();
  const matches = new Map<string, SchoolDuplicateCandidateRow>();

  async function collect(
    find: (name: string) => Promise<SchoolDuplicateCandidateRow[]>,
  ) {
    if (matches.size >= MAX_POSSIBLE_SCHOOL_DUPLICATES) {
      return;
    }

    const rows = await find(trimmedName);

    for (const row of rows) {
      if (matches.size >= MAX_POSSIBLE_SCHOOL_DUPLICATES) {
        break;
      }
      if (!matches.has(row.id)) {
        matches.set(row.id, row);
      }
    }
  }

  await collect(dependencies.findByExactName);
  await collect(dependencies.findByNameStartingWith);
  await collect(dependencies.findByNameContaining);

  return Array.from(matches.values())
    .slice(0, MAX_POSSIBLE_SCHOOL_DUPLICATES)
    .map(presentPossibleSchoolDuplicate);
}
