import "server-only";

import { prisma } from "@/src/lib/prisma";
import {
  buildEmployeeNotFoundCommercialResultsResult,
  computeCommercialResultsResult,
  type CommercialResultsPeriod,
  type CommercialResultsResult,
} from "@/src/services/commercial-results.service-core";

/**
 * Ticket 25H.2 §26: legacyUnattributedWinsInPeriod needs every
 * WON_TRANSITION in the period, not just this employee's — so, unlike
 * Execution Discipline's per-employee-scoped Prisma query, this fetch is
 * company-wide within the period and the pure core does the per-employee
 * filtering. Still scoped inside Prisma (never fetch-then-filter-in-JS
 * beyond what the evidence engine itself needs) — `type`/`occurredAt` are
 * real `where` predicates, not applied client-side.
 */
export async function computeCommercialResultsScore(
  employeeId: string,
  period: CommercialResultsPeriod,
): Promise<CommercialResultsResult> {
  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { id: true, role: true },
  });

  if (!employee) {
    return buildEmployeeNotFoundCommercialResultsResult();
  }

  const wonTransitions = await prisma.prospectActivity.findMany({
    where: {
      type: "WON_TRANSITION",
      occurredAt: { gte: period.periodStart, lte: period.periodEnd },
    },
    select: {
      type: true,
      prospectId: true,
      creditedUserId: true,
      creditedUserRoleAtEvent: true,
      occurredAt: true,
    },
  });

  return computeCommercialResultsResult(employee, period, wonTransitions);
}
