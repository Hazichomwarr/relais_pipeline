import "server-only";

import { prisma } from "@/src/lib/prisma";
import { getCommercialPerformanceTarget } from "@/src/services/commercial-performance-target.service";
import {
  buildEmployeeNotFoundCommercialResultsResult,
  computeCommercialResultsResult,
  type CommercialResultsPeriod,
  type CommercialResultsResult,
} from "@/src/services/commercial-results.service-core";

/**
 * Ticket 25H.2B — the full Results pipeline for one employee/period.
 * Renamed from 25H.2's `computeCommercialResultsScore` (which had no
 * formula yet) to avoid colliding with the pure formula core of the same
 * name now exported from commercial-results.service-core.ts.
 *
 * Ticket 25H.2 §26: legacyUnattributedWinsInPeriod needs every
 * WON_TRANSITION in the period, not just this employee's — so, unlike
 * Execution Discipline's per-employee-scoped Prisma query, this fetch is
 * company-wide within the period and the pure core does the per-employee
 * filtering. Still scoped inside Prisma (never fetch-then-filter-in-JS
 * beyond what the evidence engine itself needs) — `type`/`occurredAt` are
 * real `where` predicates, not applied client-side.
 *
 * Ticket 25H.2B §2/§26: the target is read exactly once, via
 * getCommercialPerformanceTarget's own exact-lookup contract (no
 * fallback) — this file never queries CommercialPerformanceTarget
 * directly and never mutates it.
 */
export async function getCommercialResultsForEmployee(
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

  const [wonTransitions, target] = await Promise.all([
    prisma.prospectActivity.findMany({
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
    }),
    getCommercialPerformanceTarget(employeeId, period),
  ]);

  return computeCommercialResultsResult(
    employee,
    period,
    wonTransitions,
    target,
  );
}
