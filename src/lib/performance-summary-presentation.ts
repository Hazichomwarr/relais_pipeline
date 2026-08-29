import type { PerformanceDimensionKey } from "@/src/services/performance-summary.service-core";

/**
 * Ticket 25K §26/§28 — presentation-only. No Prisma, no React (matches
 * this repo's established `*-presentation.ts` convention, e.g.
 * commercial-dashboard-presentation.ts). Converts the composition core's
 * raw, un-translated statuses into French copy for ordinary management
 * UI — internal identifiers like `LEGACY_ATTRIBUTION_INCOMPLETE` must
 * never reach the page directly (§28).
 */

/** achievementRate is a raw decimal ratio (25H.2B's own convention, e.g. 1.75) — this is the one place it becomes a percentage string for display. Never changes the underlying value. */
export function formatAchievementRate(rate: number): string {
  return `${Math.round(rate * 100)} %`;
}

/**
 * Ticket 25K §3/§28/§38 — one human-readable sentence per source status,
 * per dimension where the wording genuinely differs. Falls back to a
 * generic message for any status this function doesn't recognize,
 * rather than throwing or leaking the raw identifier.
 */
export function describeDimensionUnavailability(
  dimension: PerformanceDimensionKey,
  sourceStatus: string,
): string {
  switch (sourceStatus) {
    case "NO_TARGET":
      return "Aucun objectif n’avait été défini avant le début de cette période.";
    case "LEGACY_ATTRIBUTION_INCOMPLETE":
      return "Résultat non calculable pour cette période : certaines victoires historiques ne peuvent pas être attribuées de manière fiable.";
    case "INVALID_TARGET":
      return "L’objectif enregistré pour cette période est invalide.";
    case "INSUFFICIENT_EVIDENCE":
      return "Aucune action applicable n’a été trouvée pour cette période.";
    case "UNSUPPORTED_ROLE":
      return dimension === "RESULTS" || dimension === "EXECUTION_DISCIPLINE"
        ? "Cette dimension n’est pas évaluable pour le rôle actuel de cet employé."
        : "Cette dimension n’est pas évaluable pour ce rôle.";
    case "PERIOD_NOT_CLOSED":
      return "Cette période n’est pas encore terminée.";
    case "EMPLOYEE_NOT_FOUND":
      return "Cet employé est introuvable.";
    case "DRAFT":
      return "Une évaluation est en cours mais n’a pas encore été soumise.";
    case "NOT_STARTED":
      return "Aucune évaluation n’a encore été créée pour cette période.";
    default:
      return "Cette dimension n’est pas disponible pour cette période.";
  }
}

/**
 * Ticket 25K.1 §5/§6/§10/§11/§13/§15 — the one place that decides which
 * action, if any, a Role Responsibilities/Professional Contribution card
 * offers. Pure and testable on purpose: the dashboard page must never
 * re-derive this matrix inline in JSX, and must never show a CTA to a
 * viewer authorization says isn't allowed, regardless of status.
 *
 * Ticket 25O §23: split the old single `canAssess` input into two,
 * because they answer genuinely different questions once evaluator
 * authority narrowed to ADMIN-only:
 * - `canCreate` — may this actor start a brand-new assessment for this
 *   employee at all (general eligibility: ADMIN + supported subject).
 * - `canContinue` — may this actor specifically continue the assessment
 *   that already exists (current ADMIN authority AND being its recorded
 *   evaluator — see canMutateOwnedStructuredEvaluation). An ADMIN can
 *   have `canCreate: true` for an employee while `canContinue: false`
 *   for that same employee's existing draft, if someone else authored
 *   it (§14/§47) — the two were conflated pre-25O only because, before
 *   ADMIN-only authority, nothing distinguished "eligible to assess"
 *   from "the one who did." A DRAFT with `canContinue: false` now
 *   resolves to VIEW, not NONE, so an existing assessment is never
 *   hidden entirely just because this viewer can't mutate it.
 */
export type AssessmentActionState = "NONE" | "CREATE" | "CONTINUE" | "VIEW";

export function getAssessmentActionState(input: {
  status: "SUBMITTED" | "DRAFT" | "NOT_STARTED" | "UNSUPPORTED_ROLE";
  canCreate: boolean;
  canContinue: boolean;
  periodClosed: boolean;
}): AssessmentActionState {
  if (input.status === "SUBMITTED") {
    return "VIEW";
  }
  if (input.status === "UNSUPPORTED_ROLE") {
    return "NONE";
  }
  if (input.status === "DRAFT") {
    return input.canContinue ? "CONTINUE" : "VIEW";
  }
  // NOT_STARTED
  if (!input.canCreate) {
    return "NONE";
  }
  // 25I/25J both refuse creation before the period closes (§23 of
  // 25K.1) — a CREATE CTA that would just bounce off that check on
  // click is worse than no CTA at all.
  return input.periodClosed ? "CREATE" : "NONE";
}

export const PERFORMANCE_DIMENSION_LABELS: Record<
  PerformanceDimensionKey,
  string
> = {
  RESULTS: "Résultats",
  EXECUTION_DISCIPLINE: "Discipline d’exécution",
  ROLE_RESPONSIBILITIES: "Responsabilités de rôle",
  PROFESSIONAL_CONTRIBUTION: "Contribution professionnelle",
};

const MONTH_LABELS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

export function formatPeriodLabel(year: number, month: number): string {
  return `${MONTH_LABELS[month - 1]} ${year}`;
}

/** Ticket 25K §65 — the most recent calendar month guaranteed already closed, in the business timezone's own calendar (UTC, per this repo's existing RELAIS convention). */
export function latestClosedMonth(now: Date = new Date()): {
  year: number;
  month: number;
} {
  const lastMonthIndex = now.getUTCMonth() - 1;
  return {
    year: now.getUTCFullYear() + (lastMonthIndex < 0 ? -1 : 0),
    month: ((lastMonthIndex + 12) % 12) + 1,
  };
}
