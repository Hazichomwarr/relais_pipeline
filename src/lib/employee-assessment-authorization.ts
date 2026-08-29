import type { UserRole } from "@prisma/client";

export type EmployeeAssessmentActor = {
  id: string;
  role: UserRole;
};

/**
 * Ticket 25J §8: extracted from 25I's `canAssessRoleResponsibilities`
 * (role-responsibility-assessment.service-core.ts), which now delegates
 * here — the "who may formally evaluate whom" matrix turned out to be
 * genuinely identical across every structured performance-assessment
 * domain in this CRM (Role Responsibilities, Professional Contribution),
 * not merely similar. Sharing the *decision rule* is not the same as
 * building a shared assessment framework (25J §73 explicitly warns
 * against that): this file has no schema, no lifecycle, no catalog — it
 * is one pure function, reused because duplicating it would risk drift
 * between two independently-maintained copies of the same authorization
 * matrix.
 *
 * - COMMERCIAL assessed by: ADMIN or MANAGER (organization-wide — no
 *   manager-of-employee hierarchy exists yet).
 * - MANAGER assessed by: ADMIN only. A peer MANAGER may not, since there
 *   is no hierarchy to justify that scope.
 * - ADMIN assessed by: nobody. No valid internal evaluator exists for an
 *   ADMIN in this single-tier role model.
 * - Self-assessment is never permitted, for any role.
 */
export function canAssessEmployeeInStructuredEvaluation(
  actor: EmployeeAssessmentActor,
  employeeRole: UserRole,
  employeeId: string,
): boolean {
  if (actor.id === employeeId) {
    return false;
  }

  if (employeeRole === "COMMERCIAL") {
    return actor.role === "ADMIN" || actor.role === "MANAGER";
  }

  if (employeeRole === "MANAGER") {
    return actor.role === "ADMIN";
  }

  return false;
}
