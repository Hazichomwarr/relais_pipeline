import type { UserRole } from "@prisma/client";

import {
  canAssessEmployeeInStructuredEvaluation,
  canDeleteStructuredEvaluationDraft,
  canMutateOwnedStructuredEvaluation,
} from "@/src/lib/employee-assessment-authorization";
import {
  findProfessionalContributionTrait,
  isExtremeProfessionalContributionLevel,
  isRoleSupportedForProfessionalContribution,
  PROFESSIONAL_CONTRIBUTION_CATALOG,
  PROFESSIONAL_CONTRIBUTION_MAX_SCORE,
  PROFESSIONAL_CONTRIBUTION_POLICY_VERSION,
  type ProfessionalContributionAnchor,
  type ProfessionalContributionAnchorLevel,
  type ProfessionalContributionTraitDefinition,
} from "@/src/lib/professional-contribution-catalog";
import { type ExecutionDisciplinePeriod } from "@/src/services/execution-discipline.service-core";

/**
 * Ticket 25J — pure domain core for Professional Contribution
 * assessments. No Prisma import. Mirrors 25I's shape (create -> assess
 * -> submit -> delete, DRAFT/SUBMITTED immutability, snapshot-at-
 * creation) without importing from role-responsibility-assessment
 * files directly — the two dimensions share a lifecycle *shape*, not a
 * model or a coupling (§28/§73 of the ticket).
 */

export type ProfessionalContributionAssessmentPeriod = ExecutionDisciplinePeriod;

export type ProfessionalContributionAssessmentActor = {
  id: string;
  role: UserRole;
};

export type ProfessionalContributionAssessmentEmployeeRecord = {
  id: string;
  role: UserRole;
  active: boolean;
};

/**
 * Ticket 25J §8 — re-exported under a name specific to this domain for
 * callers that don't want to import from the shared lib module directly;
 * the implementation is the genuinely-identical matrix from
 * src/lib/employee-assessment-authorization.ts (see its own comment).
 */
export const canAssessProfessionalContribution =
  canAssessEmployeeInStructuredEvaluation;

// ---------------------------------------------------------------------------
// Pure scoring formula (Ticket 25J §18/§19)
// ---------------------------------------------------------------------------

/**
 * Proportional mapping, not a fixed per-level points table like 25I's
 * anchors: level 1 -> 0, level 5 -> maxPoints, evenly spaced across the
 * four steps between them. For Initiative (max 4) this lands on clean
 * integers (0/1/2/3/4). For the two max-3 traits it does not (0/0.75/
 * 1.5/2.25/3) — three traits cannot all divide 5 levels into whole
 * numbers while summing to exactly 10 (no combination of 3 positive
 * integers, each a multiple of 4, sums to 10). Rather than force an
 * arbitrary non-proportional table to dodge fractions, the fraction is
 * kept internally and only the *final* summed total is rounded, once
 * (§19: "internal calculation may use decimals... define deterministic
 * rounding once").
 */
export function computeProfessionalContributionTraitScore(
  level: ProfessionalContributionAnchorLevel,
  maxPoints: number,
): number {
  return (maxPoints * (level - 1)) / 4;
}

export type ProfessionalContributionScoreInput = {
  traitKey: string;
  maxPoints: number;
  selectedLevel: ProfessionalContributionAnchorLevel;
}[];

/** Sums each trait's proportional score, then rounds once. Deterministic — see the test suite's boundary cases (all-1, all-3, all-5, and a genuine .5 rounding case). */
export function computeProfessionalContributionScore(
  items: ProfessionalContributionScoreInput,
): number {
  const rawTotal = items.reduce(
    (sum, item) =>
      sum +
      computeProfessionalContributionTraitScore(
        item.selectedLevel,
        item.maxPoints,
      ),
    0,
  );

  return Math.round(rawTotal);
}

export type ProfessionalContributionErrorCode =
  | "ACCESS_DENIED"
  | "EMPLOYEE_NOT_FOUND"
  | "ROLE_NOT_SUPPORTED"
  | "PERIOD_NOT_CLOSED"
  | "DUPLICATE_PERIOD"
  | "CREATE_FAILED"
  | "NOT_FOUND"
  | "ASSESSMENT_LOCKED"
  | "ITEM_NOT_FOUND"
  | "INVALID_LEVEL"
  | "OBSERVATION_REQUIRED"
  | "UPDATE_FAILED"
  | "UNASSESSED_ITEMS"
  | "SUBMIT_FAILED"
  | "DELETE_FAILED";

function isPeriodClosed(
  period: ProfessionalContributionAssessmentPeriod,
  now: Date,
): boolean {
  return period.periodEnd.getTime() <= now.getTime();
}

// ---------------------------------------------------------------------------
// Create — snapshots the shared catalog immediately, same discipline as
// 25I's createRoleResponsibilityAssessmentCore.
// ---------------------------------------------------------------------------

export type CreateProfessionalContributionAssessmentInput = {
  employeeId: string;
  period: ProfessionalContributionAssessmentPeriod;
};

export type ProfessionalContributionItemSnapshotFields = {
  traitKey: string;
  labelAtEvaluation: string;
  descriptionAtEvaluation: string;
  maxPoints: number;
  anchorsSnapshot: readonly ProfessionalContributionAnchor[];
};

export type CreateProfessionalContributionAssessmentFields = {
  employeeUserId: string;
  roleAtEvaluation: UserRole;
  periodStart: Date;
  periodEnd: Date;
  policyVersion: string;
  evaluatorUserId: string;
  evaluatorRoleAtEvent: UserRole;
  items: readonly ProfessionalContributionItemSnapshotFields[];
};

export type CreateProfessionalContributionAssessmentResult =
  | { success: true; assessmentId: string }
  | { success: false; code: ProfessionalContributionErrorCode; message: string };

export type CreateProfessionalContributionAssessmentDependencies = {
  findEmployee: (
    userId: string,
  ) => Promise<ProfessionalContributionAssessmentEmployeeRecord | null>;
  findExisting: (
    employeeUserId: string,
    periodStart: Date,
    periodEnd: Date,
  ) => Promise<{ id: string } | null>;
  create: (
    fields: CreateProfessionalContributionAssessmentFields,
  ) => Promise<{ id: string }>;
};

function snapshotCatalog(): ProfessionalContributionItemSnapshotFields[] {
  return PROFESSIONAL_CONTRIBUTION_CATALOG.map(
    (trait: ProfessionalContributionTraitDefinition) => ({
      traitKey: trait.key,
      labelAtEvaluation: trait.label,
      descriptionAtEvaluation: trait.description,
      maxPoints: trait.maxPoints,
      anchorsSnapshot: trait.anchors,
    }),
  );
}

export async function createProfessionalContributionAssessmentCore(
  actor: ProfessionalContributionAssessmentActor,
  input: CreateProfessionalContributionAssessmentInput,
  dependencies: CreateProfessionalContributionAssessmentDependencies,
  now: Date = new Date(),
): Promise<CreateProfessionalContributionAssessmentResult> {
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

  if (!isRoleSupportedForProfessionalContribution(employee.role)) {
    return {
      success: false,
      code: "ROLE_NOT_SUPPORTED",
      message:
        "La contribution professionnelle n’est pas évaluable pour ce type d’employé.",
    };
  }

  if (
    !canAssessProfessionalContribution(actor, employee.role, employee.id)
  ) {
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

  try {
    const assessment = await dependencies.create({
      employeeUserId: input.employeeId,
      roleAtEvaluation: employee.role,
      periodStart: input.period.periodStart,
      periodEnd: input.period.periodEnd,
      policyVersion: PROFESSIONAL_CONTRIBUTION_POLICY_VERSION,
      evaluatorUserId: actor.id,
      evaluatorRoleAtEvent: actor.role,
      items: snapshotCatalog(),
    });

    return { success: true, assessmentId: assessment.id };
  } catch (error) {
    console.error(
      "Unable to create professional contribution assessment:",
      error,
    );
    return {
      success: false,
      code: "CREATE_FAILED",
      message: "L’évaluation n’a pas pu être créée. Veuillez réessayer.",
    };
  }
}

// ---------------------------------------------------------------------------
// Assess one trait (Ticket 25J §20/§36) — client sends only level/
// observation; awardedPoints is always server-computed from the item's
// own frozen maxPoints via the proportional formula, never from
// client input and never from the live catalog.
// ---------------------------------------------------------------------------

export type ProfessionalContributionAssessmentItemRow = {
  id: string;
  assessmentId: string;
  traitKey: string;
  maxPoints: number;
};

export type ProfessionalContributionAssessmentSummary = {
  id: string;
  status: "DRAFT" | "SUBMITTED";
};

export type AssessProfessionalContributionItemResult =
  | { success: true; awardedPoints: number }
  | { success: false; code: ProfessionalContributionErrorCode; message: string };

export type AssessProfessionalContributionItemDependencies = {
  findAssessment: (
    assessmentId: string,
  ) => Promise<
    | (ProfessionalContributionAssessmentSummary & { evaluatorUserId: string })
    | null
  >;
  findItem: (
    itemId: string,
  ) => Promise<ProfessionalContributionAssessmentItemRow | null>;
  update: (
    itemId: string,
    level: ProfessionalContributionAnchorLevel,
    awardedPoints: number,
    observation: string | null,
  ) => Promise<void>;
};

function isValidLevel(
  level: number,
): level is ProfessionalContributionAnchorLevel {
  return Number.isInteger(level) && level >= 1 && level <= 5;
}

export async function assessProfessionalContributionItemCore(
  actor: ProfessionalContributionAssessmentActor,
  assessmentId: string,
  itemId: string,
  level: number,
  observation: string | null,
  dependencies: AssessProfessionalContributionItemDependencies,
): Promise<AssessProfessionalContributionItemResult> {
  const assessment = await dependencies.findAssessment(assessmentId);

  if (!assessment) {
    return {
      success: false,
      code: "NOT_FOUND",
      message: "Cette évaluation est introuvable.",
    };
  }

  // Ticket 25O §6/§7/§17: current ADMIN authority AND recorded-evaluator
  // identity, not ownership alone — closes the mutation-layer gap 25L
  // found (a pre-25O MANAGER-owned draft could otherwise still be
  // edited by that MANAGER indefinitely).
  if (!canMutateOwnedStructuredEvaluation(actor, assessment.evaluatorUserId)) {
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

  if (!isValidLevel(level)) {
    return {
      success: false,
      code: "INVALID_LEVEL",
      message: "Le niveau sélectionné n’est pas valide.",
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
    isExtremeProfessionalContributionLevel(level) &&
    (!observation || observation.trim().length === 0)
  ) {
    return {
      success: false,
      code: "OBSERVATION_REQUIRED",
      message:
        "Une observation est requise pour ce niveau d’évaluation (le plus bas ou le plus haut).",
    };
  }

  const awardedPoints = computeProfessionalContributionTraitScore(
    level,
    item.maxPoints,
  );

  try {
    await dependencies.update(
      itemId,
      level,
      awardedPoints,
      observation?.trim() || null,
    );
    return { success: true, awardedPoints };
  } catch (error) {
    console.error(
      "Unable to update professional contribution item:",
      error,
    );
    return {
      success: false,
      code: "UPDATE_FAILED",
      message: "L’élément n’a pas pu être mis à jour. Veuillez réessayer.",
    };
  }
}

// ---------------------------------------------------------------------------
// Submit — server computes the final integer score by rounding the sum
// of awardedPoints exactly once; never accepts a client-sent score.
// ---------------------------------------------------------------------------

export type SubmitProfessionalContributionAssessmentResult =
  | { success: true; score: number }
  | { success: false; code: ProfessionalContributionErrorCode; message: string };

export type SubmitProfessionalContributionAssessmentDependencies = {
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

export async function submitProfessionalContributionAssessmentCore(
  actor: ProfessionalContributionAssessmentActor,
  assessmentId: string,
  dependencies: SubmitProfessionalContributionAssessmentDependencies,
): Promise<SubmitProfessionalContributionAssessmentResult> {
  const assessment = await dependencies.findAssessmentWithItems(assessmentId);

  if (!assessment) {
    return {
      success: false,
      code: "NOT_FOUND",
      message: "Cette évaluation est introuvable.",
    };
  }

  // Ticket 25O §7/§16: same current-role-plus-ownership rule as
  // assess-item — a different ADMIN, or the recorded evaluator after
  // losing ADMIN authority, may not submit this assessment.
  if (!canMutateOwnedStructuredEvaluation(actor, assessment.evaluatorUserId)) {
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
        "Tous les critères doivent être évalués avant de soumettre l’évaluation.",
    };
  }

  const score = Math.round(
    assessment.items.reduce((sum, item) => sum + (item.awardedPoints ?? 0), 0),
  );

  try {
    await dependencies.submit(assessmentId, score);
    return { success: true, score };
  } catch (error) {
    console.error(
      "Unable to submit professional contribution assessment:",
      error,
    );
    return {
      success: false,
      code: "SUBMIT_FAILED",
      message: "L’évaluation n’a pas pu être soumise. Veuillez réessayer.",
    };
  }
}

// ---------------------------------------------------------------------------
// Delete (draft only)
// ---------------------------------------------------------------------------

export type DeleteProfessionalContributionAssessmentResult =
  | { success: true }
  | { success: false; code: ProfessionalContributionErrorCode; message: string };

export type DeleteProfessionalContributionAssessmentDependencies = {
  findAssessment: (
    assessmentId: string,
  ) => Promise<
    (ProfessionalContributionAssessmentSummary & { evaluatorUserId: string }) | null
  >;
  delete: (assessmentId: string) => Promise<void>;
};

export async function deleteProfessionalContributionAssessmentCore(
  actor: ProfessionalContributionAssessmentActor,
  assessmentId: string,
  dependencies: DeleteProfessionalContributionAssessmentDependencies,
): Promise<DeleteProfessionalContributionAssessmentResult> {
  const assessment = await dependencies.findAssessment(assessmentId);

  if (!assessment) {
    return {
      success: false,
      code: "NOT_FOUND",
      message: "Cette évaluation est introuvable.",
    };
  }

  // Ticket 25O §11/§15: ADMIN-only, deliberately NOT ownership-gated —
  // this is what lets an ADMIN clean up a stranded MANAGER-owned (or
  // another ADMIN's abandoned) draft. Deletion never falsifies who
  // evaluated whom the way editing/submitting someone else's draft
  // would; it only removes an incomplete, never-submitted row.
  if (!canDeleteStructuredEvaluationDraft(actor)) {
    return {
      success: false,
      code: "ACCESS_DENIED",
      message: "Seul un administrateur peut supprimer cette évaluation.",
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
    console.error(
      "Unable to delete professional contribution assessment:",
      error,
    );
    return {
      success: false,
      code: "DELETE_FAILED",
      message: "L’évaluation n’a pas pu être supprimée. Veuillez réessayer.",
    };
  }
}

export {
  PROFESSIONAL_CONTRIBUTION_MAX_SCORE,
  findProfessionalContributionTrait,
};
