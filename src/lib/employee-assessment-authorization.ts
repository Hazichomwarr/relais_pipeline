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
 * Ticket 25O §4: evaluator authority narrowed to ADMIN only — the actor
 * must be ADMIN before any target-role rule is even considered. This
 * simplifies rather than complicates the pre-25O per-target-role
 * branching (COMMERCIAL assessed by ADMIN/MANAGER; MANAGER assessed by
 * ADMIN only): both branches collapse into one, since MANAGER is no
 * longer a valid evaluator for anyone. Subject eligibility (which
 * employee roles can be evaluated at all) is unchanged — that is 25I/25J
 * catalog/domain territory, not evaluator authority, and is explicitly
 * out of scope for 25O (§5).
 *
 * - Evaluated by: ADMIN only, for any supported subject (COMMERCIAL or
 *   MANAGER). No other role — MANAGER, COMMERCIAL, ASSISTANT — may
 *   evaluate anyone.
 * - ADMIN assessed by: nobody. No valid internal evaluator exists for an
 *   ADMIN in this single-tier role model (subject support unchanged).
 * - ASSISTANT assessed by: nobody — no subject support exists for this
 *   role in 25I/25J yet (unchanged from before 25O).
 * - Self-assessment is never permitted, for any role.
 */
export function canAssessEmployeeInStructuredEvaluation(
  actor: EmployeeAssessmentActor,
  employeeRole: UserRole,
  employeeId: string,
): boolean {
  if (actor.role !== "ADMIN") {
    return false;
  }

  if (actor.id === employeeId) {
    return false;
  }

  return employeeRole === "COMMERCIAL" || employeeRole === "MANAGER";
}

/**
 * Ticket 25O §6/§7/§12/§13/§16/§17/§18 — closes the mutation-layer gap
 * 25L found: assess-item, save-draft, and submit previously trusted
 * `evaluatorUserId` ownership alone, never re-checking the actor's
 * *current* authorization role. An existing MANAGER-owned draft would
 * otherwise remain editable by that MANAGER forever, even after
 * evaluator authority narrowed to ADMIN-only above.
 *
 * Requires BOTH current ADMIN authority AND recorded-evaluator identity
 * — an ADMIN who did not create the draft may not mutate it either
 * (§14/§47): doing so would silently change *who actually evaluated*
 * this employee without any audited transfer mechanism, corrupting
 * provenance. The one person who may ever continue a draft is its own
 * recorded evaluator, and only for as long as that person is currently
 * ADMIN (§41/§42: a former-ADMIN-now-MANAGER loses this even for their
 * own draft; a former-MANAGER-now-ADMIN regains it for their own draft
 * — current role always wins, ownership never overrides it).
 */
export function canMutateOwnedStructuredEvaluation(
  actor: EmployeeAssessmentActor,
  evaluatorUserId: string,
): boolean {
  return actor.role === "ADMIN" && actor.id === evaluatorUserId;
}

/**
 * Ticket 25O §11/§15 — deletion is deliberately NOT ownership-gated,
 * unlike every other mutation above. This is what lets an ADMIN clean up
 * a stranded MANAGER-owned draft (or another ADMIN's abandoned one)
 * without falsifying authorship the way editing/submitting it would:
 * deleting a row doesn't change any historical fact about who evaluated
 * whom, it just removes an incomplete, never-submitted one. Callers must
 * still separately reject a SUBMITTED assessment — this function only
 * expresses the actor-role half of the delete rule.
 */
export function canDeleteStructuredEvaluationDraft(
  actor: EmployeeAssessmentActor,
): boolean {
  return actor.role === "ADMIN";
}
