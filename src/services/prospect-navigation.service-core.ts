import type { Prisma } from "@prisma/client";

export type AdjacentProspectRef = {
  id: string;
  name: string;
};

export type CurrentProspectForNavigation = {
  id: string;
  createdAt: Date;
  assignedUserId: string | null;
  assignedUserName: string;
};

export type AdjacentProspects = {
  previous: AdjacentProspectRef | null;
  next: AdjacentProspectRef | null;
  context: {
    assignedUserId: string | null;
    assignedUserName: string;
  };
};

type ScopedCurrentProspect = {
  id: string;
  createdAt: Date;
  assignedUserId: string;
};

export const previousProspectOrderBy = [
  { createdAt: "asc" },
  { id: "asc" },
] satisfies Prisma.ProspectOrderByWithRelationInput[];

export const nextProspectOrderBy = [
  { createdAt: "desc" },
  { id: "desc" },
] satisfies Prisma.ProspectOrderByWithRelationInput[];

/**
 * The list is newest-first, so "previous" (the record shown just above the
 * current one) is the nearest *newer* record — strictly greater createdAt,
 * or an equal createdAt broken by a strictly greater id. Strict comparisons
 * mean the current record can never match its own query.
 */
export function buildPreviousProspectWhere(
  current: ScopedCurrentProspect,
): Prisma.ProspectWhereInput {
  return {
    assignedUserId: current.assignedUserId,
    OR: [
      { createdAt: { gt: current.createdAt } },
      { createdAt: current.createdAt, id: { gt: current.id } },
    ],
  };
}

/**
 * "next" is the nearest *older* record — the mirror image of "previous".
 */
export function buildNextProspectWhere(
  current: ScopedCurrentProspect,
): Prisma.ProspectWhereInput {
  return {
    assignedUserId: current.assignedUserId,
    OR: [
      { createdAt: { lt: current.createdAt } },
      { createdAt: current.createdAt, id: { lt: current.id } },
    ],
  };
}

export type GetAdjacentProspectsDependencies = {
  findPrevious: (
    current: ScopedCurrentProspect,
  ) => Promise<AdjacentProspectRef | null>;
  findNext: (
    current: ScopedCurrentProspect,
  ) => Promise<AdjacentProspectRef | null>;
};

/**
 * Only ever scopes by the already-authorized current prospect's own
 * assignedUserId — nothing here accepts an externally-supplied assignment,
 * so a manipulated route/query parameter has no path to widen the scope.
 */
export async function getAdjacentProspectsCore(
  current: CurrentProspectForNavigation,
  dependencies: GetAdjacentProspectsDependencies,
): Promise<AdjacentProspects> {
  const context = {
    assignedUserId: current.assignedUserId,
    assignedUserName: current.assignedUserName,
  };

  if (!current.assignedUserId) {
    return { previous: null, next: null, context };
  }

  const scoped: ScopedCurrentProspect = {
    id: current.id,
    createdAt: current.createdAt,
    assignedUserId: current.assignedUserId,
  };

  const [previous, next] = await Promise.all([
    dependencies.findPrevious(scoped),
    dependencies.findNext(scoped),
  ]);

  return { previous, next, context };
}
