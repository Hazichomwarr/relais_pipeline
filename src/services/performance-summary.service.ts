import "server-only";

import { prisma } from "@/src/lib/prisma";
import type { ExecutionDisciplinePeriod } from "@/src/services/execution-discipline.service-core";
import { computeCommercialExecutionDisciplineScore } from "@/src/services/execution-discipline.service";
import { getCommercialResultsForEmployee } from "@/src/services/commercial-results.service";
import { getRoleResponsibilityAssessmentForEmployeePeriod } from "@/src/services/role-responsibility-assessment.service";
import { getProfessionalContributionAssessmentForEmployeePeriod } from "@/src/services/professional-contribution.service";
import { isRoleSupportedForRoleResponsibilityAssessment } from "@/src/lib/role-responsibility-catalog";
import { isRoleSupportedForProfessionalContribution } from "@/src/lib/professional-contribution-catalog";
import { canAssessEmployeeInStructuredEvaluation } from "@/src/lib/employee-assessment-authorization";
import {
  canViewEmployeePerformance,
  composePerformanceSummary,
  type PerformanceEvaluationSummary,
  type StructuredAssessmentDimensionSummary,
} from "@/src/services/performance-summary.service-core";
import type { UserRole } from "@prisma/client";

export type PerformanceSummaryResult =
  | {
      status: "FOUND";
      employee: { id: string; firstName: string; lastName: string; role: UserRole };
      summary: PerformanceEvaluationSummary;
      /**
       * Ticket 25K.1 §13/§14 — assess (write) authority, computed here via
       * the same shared primitive 25I/25J already gate creation with. Kept
       * entirely separate from canViewEmployeePerformance above: a viewer
       * can see this summary without being allowed to act on it.
       */
      canAssess: boolean;
    }
  | { status: "EMPLOYEE_NOT_FOUND" }
  | { status: "ACCESS_DENIED" };

function toStructuredAssessmentSummary(
  row:
    | { id: string; status: "DRAFT" | "SUBMITTED"; score: number | null; maxScore: number }
    | null,
  maxScore: number,
): StructuredAssessmentDimensionSummary {
  if (!row) {
    return { status: "NOT_STARTED", score: null, maxScore, assessmentId: null };
  }
  if (row.status === "SUBMITTED" && row.score !== null) {
    return {
      status: "SUBMITTED",
      score: row.score,
      maxScore: row.maxScore,
      assessmentId: row.id,
    };
  }
  return {
    status: "DRAFT",
    score: null,
    maxScore: row.maxScore,
    assessmentId: row.id,
  };
}

/**
 * Ticket 25K §7 — the one composition service: the canonical management
 * read model. Fetches all four dimensions in parallel from their own
 * authoritative services (never recomputing any formula, §6) and hands
 * them to the pure core. Read-only — no assessment, target, or snapshot
 * is created as a side effect of calling this (§41).
 *
 * Employee existence is checked once, here, rather than letting each of
 * the four sub-fetches independently report "not found" — a single
 * definitive EMPLOYEE_NOT_FOUND result is clearer than a summary whose
 * every blocker happens to say the same thing for the same reason.
 *
 * Ticket 25K §36 — `actor` and `employeeId` both come from the server
 * (session + route param), never trusted from a client-supplied scope
 * claim: canViewEmployeePerformance is re-checked here regardless of
 * whatever the calling route's coarse gate already established.
 */
export async function getEmployeePerformanceSummary(
  actor: { id: string; role: UserRole },
  employeeId: string,
  period: ExecutionDisciplinePeriod,
): Promise<PerformanceSummaryResult> {
  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { id: true, firstName: true, lastName: true, role: true },
  });

  if (!employee) {
    return { status: "EMPLOYEE_NOT_FOUND" };
  }

  if (!canViewEmployeePerformance(actor.role, employee.role)) {
    return { status: "ACCESS_DENIED" };
  }

  const roleResponsibilitySupported = isRoleSupportedForRoleResponsibilityAssessment(
    employee.role,
  );
  const professionalContributionSupported = isRoleSupportedForProfessionalContribution(
    employee.role,
  );

  const [
    results,
    executionDiscipline,
    roleResponsibilityRow,
    professionalContributionRow,
  ] = await Promise.all([
    getCommercialResultsForEmployee(employeeId, period),
    computeCommercialExecutionDisciplineScore(employeeId, period),
    roleResponsibilitySupported
      ? getRoleResponsibilityAssessmentForEmployeePeriod(employeeId, period)
      : Promise.resolve(null),
    professionalContributionSupported
      ? getProfessionalContributionAssessmentForEmployeePeriod(employeeId, period)
      : Promise.resolve(null),
  ]);

  const summary = composePerformanceSummary({
    results,
    executionDiscipline,
    roleResponsibilities: roleResponsibilitySupported
      ? toStructuredAssessmentSummary(roleResponsibilityRow, 20)
      : { status: "UNSUPPORTED_ROLE", score: null, maxScore: 20, assessmentId: null },
    professionalContribution: professionalContributionSupported
      ? toStructuredAssessmentSummary(professionalContributionRow, 10)
      : { status: "UNSUPPORTED_ROLE", score: null, maxScore: 10, assessmentId: null },
  });

  const canAssess = canAssessEmployeeInStructuredEvaluation(
    actor,
    employee.role,
    employee.id,
  );

  return { status: "FOUND", employee, summary, canAssess };
}
