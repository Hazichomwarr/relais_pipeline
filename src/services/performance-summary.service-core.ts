import type { UserRole } from "@prisma/client";

import type { CommercialResultsResult } from "@/src/services/commercial-results.service-core";
import type { ExecutionDisciplineResult } from "@/src/services/execution-discipline.service-core";

/**
 * Ticket 25K — pure composition core. No Prisma import, no re-scoring:
 * this file only combines four already-computed dimension results into
 * one read model. It never recomputes Results/Execution Discipline
 * formulas (imported only as *types*, for the discriminated-union
 * narrowing below) and never touches Role Responsibility/Professional
 * Contribution's catalogs at all.
 *
 * Required audit before writing this file (documented in
 * notes/ticket-25k-management-performance-dashboard.md, restated here
 * because it drove the two design decisions below):
 *
 * 1. Execution Discipline has NO per-action role snapshot — ProspectAction
 *    carries assignedToUserId/dueAt/completedAt/canceledAt/status, and
 *    nothing else identifying what role the assignee held at the time.
 *    Results, by contrast, DOES have creditedUserRoleAtEvent (25H.1).
 *    This asymmetry means a historical "was this person a COMMERCIAL
 *    during period X" reconstruction is possible for Results but not
 *    for Execution Discipline — so 25K cannot honestly offer a
 *    role-independent historical view for both machine-derived
 *    dimensions equally.
 * 2. Given that asymmetry, this ticket does NOT attempt to bypass
 *    either dimension's current-role-gated top-level orchestrator
 *    (computeCommercialResultsResult / computeExecutionDisciplineResult,
 *    both already correctly period-scoped and reusable for any closed
 *    historical period). A former-COMMERCIAL-now-MANAGER's historical
 *    evidence is not reconstructed by 25K — this falls out naturally as
 *    an honest UNSUPPORTED_ROLE blocker, not a special case, and matches
 *    the ticket's own §53 "perfectly acceptable" V1 boundary.
 */

/**
 * Ticket 25K §34/§35 — viewing authority, distinct from 25I/25J's
 * assessment (write) authority: no self-view restriction is meaningful
 * here (an ADMIN viewing their own dashboard, however unsupported its
 * content, isn't a conflict-of-interest the way self-assessment is),
 * and MANAGER is not granted ADMIN-viewing the way it's granted
 * MANAGER-assessment-by-ADMIN-only — MANAGER simply cannot view another
 * MANAGER's dashboard in V1, full stop. Deliberately NOT the same
 * function as canAssessEmployeeInStructuredEvaluation (§73: viewing and
 * assessing are different permissions; coupling them would coincidentally
 * work today and silently diverge the moment either policy changes).
 *
 * - ADMIN may view any employee (§34).
 * - MANAGER may view COMMERCIAL employees only (§34/§35) — organization-
 *   wide, not team-scoped, since no manager-of-employee hierarchy exists.
 * - COMMERCIAL may never view the management dashboard (§34).
 */
export function canViewEmployeePerformance(
  actorRole: UserRole,
  employeeRole: UserRole,
): boolean {
  if (actorRole === "ADMIN") {
    return true;
  }
  if (actorRole === "MANAGER") {
    return employeeRole === "COMMERCIAL";
  }
  return false;
}

export type PerformanceDimensionKey =
  | "RESULTS"
  | "EXECUTION_DISCIPLINE"
  | "ROLE_RESPONSIBILITIES"
  | "PROFESSIONAL_CONTRIBUTION";

/**
 * Ticket 25I/25J don't have a rich multi-state result type the way
 * Results/Execution Discipline do (§4 of this ticket: "do not collapse
 * ... into MISSING" — the *source* status must stay recoverable). This
 * is the minimal shape 25K needs from either assessment domain:
 * `NOT_STARTED` when no row exists for the exact period at all,
 * distinct from `DRAFT` (a row exists but isn't finalized yet) and
 * `SUBMITTED` (finalized, historically authoritative).
 *
 * Ticket 25K.1 §15: `UNSUPPORTED_ROLE` is a distinct source status from
 * `NOT_STARTED` — an ADMIN employee has no row because no row can ever
 * exist for that role (the catalog has no entry), not because nobody has
 * gotten to it yet. Collapsing the two would let the UI offer a creation
 * CTA for a role the assessment domain doesn't support.
 *
 * `assessmentId` is carried alongside DRAFT/SUBMITTED so the navigation
 * layer can deep-link straight to the existing detail/edit route without
 * a second lookup; it is `null` whenever no row exists at all.
 *
 * `evaluatorUserId` (Ticket 25O §23) is carried the same way, so the
 * dashboard can decide `canContinue` (is *this* viewer the recorded
 * evaluator, not just generically eligible to assess) without a second
 * lookup either — this is what lets a DRAFT authored by someone else
 * resolve to VIEW instead of CONTINUE.
 */
export type StructuredAssessmentDimensionSummary =
  | {
      status: "SUBMITTED";
      score: number;
      maxScore: number;
      assessmentId: string;
      evaluatorUserId: string;
    }
  | {
      status: "DRAFT";
      score: null;
      maxScore: number;
      assessmentId: string;
      evaluatorUserId: string;
    }
  | {
      status: "NOT_STARTED";
      score: null;
      maxScore: number;
      assessmentId: null;
      evaluatorUserId: null;
    }
  | {
      status: "UNSUPPORTED_ROLE";
      score: null;
      maxScore: number;
      assessmentId: null;
      evaluatorUserId: null;
    };

export type PerformanceDimensionBlocker = {
  dimension: PerformanceDimensionKey;
  /** The exact, un-translated status from the source dimension (e.g. "NO_TARGET", "DRAFT") — never collapsed, per §4. UI translates this to French; the core never does. */
  sourceStatus: string;
};

export type PerformanceEvaluationSummary = {
  results: CommercialResultsResult;
  executionDiscipline: ExecutionDisciplineResult;
  roleResponsibilities: StructuredAssessmentDimensionSummary;
  professionalContribution: StructuredAssessmentDimensionSummary;
  /** Ticket 25K §11 — only when BOTH machine-derived dimensions are SCORED; never a partial subtotal built from one. */
  machineDerivedSubtotal: { score: number; maxScore: 70 } | null;
  /** Ticket 25K §12 — only when BOTH structured-assessment dimensions are SUBMITTED. */
  humanAssessedSubtotal: { score: number; maxScore: 30 } | null;
  /** Ticket 25K §2/§9 — only when all four dimensions are authoritative. Plain sum: each component is already expressed in its final weighted range, no further weighting. */
  overall: { score: number; maxScore: 100 } | null;
  status: "COMPLETE" | "INCOMPLETE";
  blockers: PerformanceDimensionBlocker[];
};

export type PerformanceSummaryInput = {
  results: CommercialResultsResult;
  executionDiscipline: ExecutionDisciplineResult;
  roleResponsibilities: StructuredAssessmentDimensionSummary;
  professionalContribution: StructuredAssessmentDimensionSummary;
};

/**
 * Ticket 25K §8 — the pure composition core. Deciding "does an overall
 * score exist, what is it, what blocks it" is the entire job; no Prisma,
 * no formatting, no French copy.
 */
export function composePerformanceSummary(
  input: PerformanceSummaryInput,
): PerformanceEvaluationSummary {
  const blockers: PerformanceDimensionBlocker[] = [];

  if (input.results.status !== "SCORED") {
    blockers.push({ dimension: "RESULTS", sourceStatus: input.results.status });
  }
  if (input.executionDiscipline.status !== "SCORED") {
    blockers.push({
      dimension: "EXECUTION_DISCIPLINE",
      sourceStatus: input.executionDiscipline.status,
    });
  }
  if (input.roleResponsibilities.status !== "SUBMITTED") {
    blockers.push({
      dimension: "ROLE_RESPONSIBILITIES",
      sourceStatus: input.roleResponsibilities.status,
    });
  }
  if (input.professionalContribution.status !== "SUBMITTED") {
    blockers.push({
      dimension: "PROFESSIONAL_CONTRIBUTION",
      sourceStatus: input.professionalContribution.status,
    });
  }

  const machineDerivedSubtotal =
    input.results.status === "SCORED" &&
    input.executionDiscipline.status === "SCORED"
      ? {
          score: input.results.score + input.executionDiscipline.score,
          maxScore: 70 as const,
        }
      : null;

  const humanAssessedSubtotal =
    input.roleResponsibilities.status === "SUBMITTED" &&
    input.professionalContribution.status === "SUBMITTED"
      ? {
          score:
            input.roleResponsibilities.score +
            input.professionalContribution.score,
          maxScore: 30 as const,
        }
      : null;

  const overall =
    blockers.length === 0 && machineDerivedSubtotal && humanAssessedSubtotal
      ? {
          score: machineDerivedSubtotal.score + humanAssessedSubtotal.score,
          maxScore: 100 as const,
        }
      : null;

  return {
    results: input.results,
    executionDiscipline: input.executionDiscipline,
    roleResponsibilities: input.roleResponsibilities,
    professionalContribution: input.professionalContribution,
    machineDerivedSubtotal,
    humanAssessedSubtotal,
    overall,
    status: overall ? "COMPLETE" : "INCOMPLETE",
    blockers,
  };
}

/**
 * Ticket 25K §55/§56/§57/§58 — deliberately absent from this file: no
 * multi-period averaging, no team average, no performance bands, no
 * red/yellow/green grading. One employee, one period, one explainable
 * evaluation. Adding any of those means editing this file, not layering
 * them on in a component.
 */
