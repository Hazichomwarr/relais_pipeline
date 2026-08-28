import type { UserRole } from "@prisma/client";

import {
  findRoleResponsibilityDefinition,
  getRoleResponsibilityCatalogForRole,
  isExtremeRoleResponsibilityLevel,
  isRoleSupportedForRoleResponsibilityAssessment,
  ROLE_RESPONSIBILITY_MAX_SCORE,
  ROLE_RESPONSIBILITY_POLICY_VERSION,
  type RoleResponsibilityAnchor,
  type RoleResponsibilityAssessmentLevelValue,
  type RoleResponsibilityDefinition,
  type RoleResponsibilityEvidenceType,
} from "@/src/lib/role-responsibility-catalog";
import { type ExecutionDisciplinePeriod } from "@/src/services/execution-discipline.service-core";

/**
 * Ticket 25I — pure domain core for Role Responsibility assessments. No
 * Prisma import. Combines the frozen catalog (role-responsibility-catalog.ts)
 * with the create/assess/submit lifecycle; every rule the ticket's audit
 * required (no self-assessment, no ADMIN evaluator path, no role-history
 * fabrication, no client-supplied score) is enforced here, not only at
 * the route layer.
 */

export type RoleResponsibilityAssessmentPeriod = ExecutionDisciplinePeriod;

export type RoleResponsibilityAssessmentActor = {
  id: string;
  role: UserRole;
};

export type RoleResponsibilityAssessmentEmployeeRecord = {
  id: string;
  role: UserRole;
  active: boolean;
};

/**
 * Ticket 25I §20/§21 — who may assess whom. Depends on the *target's*
 * role, not only the actor's, so this cannot live as a flat role-array
 * constant the way authorization.service-core.ts's other lists do:
 *
 * - COMMERCIAL assessed by: ADMIN or MANAGER (organization-wide, same
 *   limitation as CommercialPerformanceTarget's authority — no
 *   manager-of-employee hierarchy exists yet).
 * - MANAGER assessed by: ADMIN only. A peer MANAGER assessing another
 *   MANAGER, with no hierarchy to justify it, would be exactly the
 *   arbitrary authority the audit warned against — narrower is safer.
 * - ADMIN assessed by: nobody. No responsibility survived audit for
 *   ADMIN (see the catalog's own comment) and no valid internal
 *   evaluator exists for one even if a responsibility did.
 * - Self-assessment is never permitted, regardless of role (§21).
 */
export function canAssessRoleResponsibilities(
  actor: RoleResponsibilityAssessmentActor,
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

export type RoleResponsibilityAssessmentErrorCode =
  | "ACCESS_DENIED"
  | "EMPLOYEE_NOT_FOUND"
  | "ROLE_NOT_SUPPORTED"
  | "PERIOD_NOT_CLOSED"
  | "DUPLICATE_PERIOD"
  | "CREATE_FAILED"
  | "NOT_FOUND"
  | "ASSESSMENT_LOCKED"
  | "ITEM_NOT_FOUND"
  | "OBSERVATION_REQUIRED"
  | "UPDATE_FAILED"
  | "UNASSESSED_ITEMS"
  | "SUBMIT_FAILED"
  | "DELETE_FAILED";

function isPeriodClosed(
  period: RoleResponsibilityAssessmentPeriod,
  now: Date,
): boolean {
  return period.periodEnd.getTime() <= now.getTime();
}

// ---------------------------------------------------------------------------
// Create (Ticket 25I §28) — snapshots the catalog immediately, never at
// submission time, so a mid-draft catalog edit can't silently change
// what an open draft is scoring against.
// ---------------------------------------------------------------------------

export type CreateRoleResponsibilityAssessmentInput = {
  employeeId: string;
  period: RoleResponsibilityAssessmentPeriod;
};

export type RoleResponsibilityItemSnapshotFields = {
  responsibilityKey: string;
  labelAtEvaluation: string;
  descriptionAtEvaluation: string;
  maxPoints: number;
  evidenceType: RoleResponsibilityEvidenceType;
  anchorsSnapshot: readonly RoleResponsibilityAnchor[];
};

export type CreateRoleResponsibilityAssessmentFields = {
  employeeUserId: string;
  roleAtEvaluation: UserRole;
  periodStart: Date;
  periodEnd: Date;
  policyVersion: string;
  evaluatorUserId: string;
  evaluatorRoleAtEvent: UserRole;
  items: readonly RoleResponsibilityItemSnapshotFields[];
};

export type CreateRoleResponsibilityAssessmentResult =
  | { success: true; assessmentId: string }
  | {
      success: false;
      code: RoleResponsibilityAssessmentErrorCode;
      message: string;
    };

export type CreateRoleResponsibilityAssessmentDependencies = {
  findEmployee: (
    userId: string,
  ) => Promise<RoleResponsibilityAssessmentEmployeeRecord | null>;
  findExisting: (
    employeeUserId: string,
    periodStart: Date,
    periodEnd: Date,
  ) => Promise<{ id: string } | null>;
  create: (
    fields: CreateRoleResponsibilityAssessmentFields,
  ) => Promise<{ id: string }>;
};

function snapshotCatalogFor(
  role: UserRole,
): RoleResponsibilityItemSnapshotFields[] {
  return getRoleResponsibilityCatalogForRole(role).map(
    (definition: RoleResponsibilityDefinition) => ({
      responsibilityKey: definition.key,
      labelAtEvaluation: definition.label,
      descriptionAtEvaluation: definition.description,
      maxPoints: definition.maxPoints,
      evidenceType: definition.evidenceType,
      anchorsSnapshot: definition.anchors,
    }),
  );
}

export async function createRoleResponsibilityAssessmentCore(
  actor: RoleResponsibilityAssessmentActor,
  input: CreateRoleResponsibilityAssessmentInput,
  dependencies: CreateRoleResponsibilityAssessmentDependencies,
  now: Date = new Date(),
): Promise<CreateRoleResponsibilityAssessmentResult> {
  if (!isPeriodClosed(input.period, now)) {
    return {
      success: false,
      code: "PERIOD_NOT_CLOSED",
      message:
        "Impossible d’évaluer une période qui n’est pas encore terminée.",
    };
  }

  const employee = await dependencies.findEmployee(input.employeeId);

  if (!employee || !employee.active) {
    return {
      success: false,
      code: "EMPLOYEE_NOT_FOUND",
      message: "Cet employé est introuvable ou inactif.",
    };
  }

  if (!isRoleSupportedForRoleResponsibilityAssessment(employee.role)) {
    return {
      success: false,
      code: "ROLE_NOT_SUPPORTED",
      message:
        "Aucune responsabilité de rôle n’est définie pour ce type d’employé.",
    };
  }

  if (!canAssessRoleResponsibilities(actor, employee.role, employee.id)) {
    return {
      success: false,
      code: "ACCESS_DENIED",
      message: "Vous n’avez pas le droit d’évaluer cet employé.",
    };
  }

  const existing = await dependencies.findExisting(
    input.employeeId,
    input.period.periodStart,
    input.period.periodEnd,
  );

  if (existing) {
    return {
      success: false,
      code: "DUPLICATE_PERIOD",
      message: "Une évaluation existe déjà pour cet employé sur cette période.",
    };
  }

  const items = snapshotCatalogFor(employee.role);

  try {
    const assessment = await dependencies.create({
      employeeUserId: input.employeeId,
      roleAtEvaluation: employee.role,
      periodStart: input.period.periodStart,
      periodEnd: input.period.periodEnd,
      policyVersion: ROLE_RESPONSIBILITY_POLICY_VERSION,
      evaluatorUserId: actor.id,
      evaluatorRoleAtEvent: actor.role,
      items,
    });

    return { success: true, assessmentId: assessment.id };
  } catch (error) {
    console.error("Unable to create role responsibility assessment:", error);
    return {
      success: false,
      code: "CREATE_FAILED",
      message: "L’évaluation n’a pas pu être créée. Veuillez réessayer.",
    };
  }
}

// ---------------------------------------------------------------------------
// Assess one item (Ticket 25I §29/§30/§35) — the client sends only
// `level`/`observation`; awardedPoints is always server-computed from the
// item's own frozen anchorsSnapshot, never from the live catalog and
// never from client input.
// ---------------------------------------------------------------------------

export type RoleResponsibilityAssessmentItemRow = {
  id: string;
  assessmentId: string;
  responsibilityKey: string;
  anchorsSnapshot: readonly RoleResponsibilityAnchor[];
};

export type RoleResponsibilityAssessmentSummary = {
  id: string;
  status: "DRAFT" | "SUBMITTED";
};

export type AssessRoleResponsibilityItemResult =
  | { success: true; awardedPoints: number }
  | {
      success: false;
      code: RoleResponsibilityAssessmentErrorCode;
      message: string;
    };

export type AssessRoleResponsibilityItemDependencies = {
  findAssessment: (
    assessmentId: string,
  ) => Promise<
    | (RoleResponsibilityAssessmentSummary & { evaluatorUserId: string })
    | null
  >;
  findItem: (
    itemId: string,
  ) => Promise<RoleResponsibilityAssessmentItemRow | null>;
  update: (
    itemId: string,
    level: RoleResponsibilityAssessmentLevelValue,
    awardedPoints: number,
    observation: string | null,
  ) => Promise<void>;
};

function findAnchorPoints(
  anchors: readonly RoleResponsibilityAnchor[],
  level: RoleResponsibilityAssessmentLevelValue,
): number | null {
  return anchors.find((anchor) => anchor.level === level)?.points ?? null;
}

export async function assessRoleResponsibilityItemCore(
  actor: RoleResponsibilityAssessmentActor,
  assessmentId: string,
  itemId: string,
  level: RoleResponsibilityAssessmentLevelValue,
  observation: string | null,
  dependencies: AssessRoleResponsibilityItemDependencies,
): Promise<AssessRoleResponsibilityItemResult> {
  const assessment = await dependencies.findAssessment(assessmentId);

  if (!assessment) {
    return {
      success: false,
      code: "NOT_FOUND",
      message: "Cette évaluation est introuvable.",
    };
  }

  if (assessment.evaluatorUserId !== actor.id) {
    return {
      success: false,
      code: "ACCESS_DENIED",
      message: "Seul l’évaluateur peut modifier cette évaluation.",
    };
  }

  if (assessment.status === "SUBMITTED") {
    return {
      success: false,
      code: "ASSESSMENT_LOCKED",
      message: "Cette évaluation a déjà été soumise et ne peut plus être modifiée.",
    };
  }

  const item = await dependencies.findItem(itemId);

  if (!item || item.assessmentId !== assessmentId) {
    return {
      success: false,
      code: "ITEM_NOT_FOUND",
      message: "Cet élément d’évaluation est introuvable.",
    };
  }

  if (
    isExtremeRoleResponsibilityLevel(level) &&
    (!observation || observation.trim().length === 0)
  ) {
    return {
      success: false,
      code: "OBSERVATION_REQUIRED",
      message:
        "Une observation est requise pour ce niveau d’évaluation (le plus bas ou le plus haut).",
    };
  }

  const awardedPoints = findAnchorPoints(item.anchorsSnapshot, level);

  if (awardedPoints === null) {
    // Structurally unreachable with a valid RoleResponsibilityAssessmentLevelValue
    // and a catalog-produced snapshot, but never trust it silently.
    return {
      success: false,
      code: "UPDATE_FAILED",
      message: "Ce niveau n’est pas valide pour cet élément.",
    };
  }

  try {
    await dependencies.update(
      itemId,
      level,
      awardedPoints,
      observation?.trim() || null,
    );
    return { success: true, awardedPoints };
  } catch (error) {
    console.error("Unable to update role responsibility item:", error);
    return {
      success: false,
      code: "UPDATE_FAILED",
      message: "L’élément n’a pas pu être mis à jour. Veuillez réessayer.",
    };
  }
}

// ---------------------------------------------------------------------------
// Submit (Ticket 25I §30/§62/§63) — server computes the final score by
// summing awardedPoints; never accepts a client-sent score.
// ---------------------------------------------------------------------------

export type SubmitRoleResponsibilityAssessmentResult =
  | { success: true; score: number }
  | {
      success: false;
      code: RoleResponsibilityAssessmentErrorCode;
      message: string;
    };

export type SubmitRoleResponsibilityAssessmentDependencies = {
  findAssessmentWithItems: (assessmentId: string) => Promise<
    | {
        id: string;
        status: "DRAFT" | "SUBMITTED";
        evaluatorUserId: string;
        items: readonly { id: string; awardedPoints: number | null }[];
      }
    | null
  >;
  submit: (assessmentId: string, score: number) => Promise<void>;
};

export async function submitRoleResponsibilityAssessmentCore(
  actor: RoleResponsibilityAssessmentActor,
  assessmentId: string,
  dependencies: SubmitRoleResponsibilityAssessmentDependencies,
): Promise<SubmitRoleResponsibilityAssessmentResult> {
  const assessment = await dependencies.findAssessmentWithItems(assessmentId);

  if (!assessment) {
    return {
      success: false,
      code: "NOT_FOUND",
      message: "Cette évaluation est introuvable.",
    };
  }

  if (assessment.evaluatorUserId !== actor.id) {
    return {
      success: false,
      code: "ACCESS_DENIED",
      message: "Seul l’évaluateur peut soumettre cette évaluation.",
    };
  }

  if (assessment.status === "SUBMITTED") {
    return {
      success: false,
      code: "ASSESSMENT_LOCKED",
      message: "Cette évaluation a déjà été soumise.",
    };
  }

  const unassessed = assessment.items.filter(
    (item) => item.awardedPoints === null,
  );

  if (unassessed.length > 0) {
    return {
      success: false,
      code: "UNASSESSED_ITEMS",
      message:
        "Tous les éléments doivent être évalués avant de soumettre l’évaluation.",
    };
  }

  const score = assessment.items.reduce(
    (sum, item) => sum + (item.awardedPoints ?? 0),
    0,
  );

  try {
    await dependencies.submit(assessmentId, score);
    return { success: true, score };
  } catch (error) {
    console.error("Unable to submit role responsibility assessment:", error);
    return {
      success: false,
      code: "SUBMIT_FAILED",
      message: "L’évaluation n’a pas pu être soumise. Veuillez réessayer.",
    };
  }
}

// ---------------------------------------------------------------------------
// Delete (draft only — Ticket 25I §27)
// ---------------------------------------------------------------------------

export type DeleteRoleResponsibilityAssessmentResult =
  | { success: true }
  | {
      success: false;
      code: RoleResponsibilityAssessmentErrorCode;
      message: string;
    };

export type DeleteRoleResponsibilityAssessmentDependencies = {
  findAssessment: (
    assessmentId: string,
  ) => Promise<
    (RoleResponsibilityAssessmentSummary & { evaluatorUserId: string }) | null
  >;
  delete: (assessmentId: string) => Promise<void>;
};

export async function deleteRoleResponsibilityAssessmentCore(
  actor: RoleResponsibilityAssessmentActor,
  assessmentId: string,
  dependencies: DeleteRoleResponsibilityAssessmentDependencies,
): Promise<DeleteRoleResponsibilityAssessmentResult> {
  const assessment = await dependencies.findAssessment(assessmentId);

  if (!assessment) {
    return {
      success: false,
      code: "NOT_FOUND",
      message: "Cette évaluation est introuvable.",
    };
  }

  if (assessment.evaluatorUserId !== actor.id) {
    return {
      success: false,
      code: "ACCESS_DENIED",
      message: "Seul l’évaluateur peut supprimer cette évaluation.",
    };
  }

  if (assessment.status === "SUBMITTED") {
    return {
      success: false,
      code: "ASSESSMENT_LOCKED",
      message: "Une évaluation soumise ne peut pas être supprimée.",
    };
  }

  try {
    await dependencies.delete(assessmentId);
    return { success: true };
  } catch (error) {
    console.error("Unable to delete role responsibility assessment:", error);
    return {
      success: false,
      code: "DELETE_FAILED",
      message: "L’évaluation n’a pas pu être supprimée. Veuillez réessayer.",
    };
  }
}

export { ROLE_RESPONSIBILITY_MAX_SCORE, findRoleResponsibilityDefinition };
