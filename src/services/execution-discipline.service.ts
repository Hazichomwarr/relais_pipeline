import "server-only";

import { prisma } from "@/src/lib/prisma";
import {
  buildEmployeeNotFoundExecutionDisciplineResult,
  computeExecutionDisciplineResult,
  type ExecutionDisciplinePeriod,
  type ExecutionDisciplineResult,
} from "@/src/services/execution-discipline.service-core";

/**
 * Ticket 25H §26: domain computation only, server-side. No Server
 * Action/route is added in this ticket — 25K owns the management UI.
 *
 * Ticket 25H §5/§17: fetching scopes by `assignedToUserId` + `dueAt`
 * inside Prisma (never fetch-then-filter-in-JS, per this repo's own
 * house rule) — the pure core then re-applies the same population rule
 * defensively, so its correctness never depends on this query being
 * right (see buildExecutionDisciplineEvidence's own comment).
 */
export async function computeCommercialExecutionDisciplineScore(
  employeeId: string,
  period: ExecutionDisciplinePeriod,
): Promise<ExecutionDisciplineResult> {
  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { id: true, role: true },
  });

  if (!employee) {
    return buildEmployeeNotFoundExecutionDisciplineResult();
  }

  const actions = await prisma.prospectAction.findMany({
    where: {
      assignedToUserId: employeeId,
      dueAt: { gte: period.periodStart, lte: period.periodEnd },
    },
    select: {
      assignedToUserId: true,
      status: true,
      dueAt: true,
      completedAt: true,
      canceledAt: true,
    },
  });

  return computeExecutionDisciplineResult(employee, period, actions);
}
