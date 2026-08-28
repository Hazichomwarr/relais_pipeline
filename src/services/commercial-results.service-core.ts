import type { ProspectActivityType, UserRole } from "@prisma/client";

import { type ExecutionDisciplinePeriod } from "@/src/services/execution-discipline.service-core";

/**
 * Ticket 25H.2 — the Results evidence engine. This file deliberately does
 * NOT compute a `/40` score: the required audit (see
 * notes/ticket-25h2-commercial-results-score-engine.md) found neither a
 * historically durable ownership-during-period denominator (Prospect has
 * no assignment-history model — confirmed repo-wide) nor any existing
 * performance target/quota domain concept (confirmed by exhaustive grep —
 * the one hit, `*_PROSPECTING_TARGET`, is an unrelated Operations
 * Coordinator daily-report constant). That is Outcome C from the ticket's
 * own decision tree: implement the evidence collector, leave numeric
 * scoring explicitly blocked pending a dedicated target-domain ticket.
 * Do not add a formula here to make this file "feel finished" — an
 * invented denominator would be less honest than no score at all.
 */

export const COMMERCIAL_RESULTS_POLICY_VERSION = "COMMERCIAL_RESULTS_V1";
export const COMMERCIAL_RESULTS_MAX_SCORE = 40;

/**
 * Reused, not redefined (Ticket 25H.2 §3: "do not create a competing
 * period policy between Results and Execution") — an explicit closed
 * interval, both bounds inclusive, never derived from "today."
 */
export type CommercialResultsPeriod = ExecutionDisciplinePeriod;

/**
 * Ticket 25G §6/§27, same reasoning as Execution Discipline: only
 * COMMERCIAL has audited Results evidence today. This gates whether the
 * top-level orchestrator (computeCommercialResultsResult) will produce a
 * Results dimension for this person's *current* profile at all — it does
 * NOT gate which historical WON events count as evidence once evidence
 * collection runs (see collectCommercialResultsEvidence's own comment on
 * why current role and event-time role are deliberately independent).
 */
const SCORABLE_ROLES: ReadonlySet<UserRole> = new Set(["COMMERCIAL"]);

export function isScorableForCommercialResults(role: UserRole): boolean {
  return SCORABLE_ROLES.has(role);
}

export type CommercialResultsEmployee = {
  id: string;
  role: UserRole;
};

/**
 * The fields this engine needs from a ProspectActivity row. Deliberately
 * excludes `agentName` — Results evidence must never fall back to the
 * closing actor (25H.1's whole point) — and excludes any Prospect
 * relation: the canonical result timestamp is `occurredAt` on this row,
 * never `Prospect.updatedAt` (Ticket 25H.2 §16), and identity matching
 * uses `creditedUserId` alone, never a name snapshot (§19).
 */
export type CommercialResultsWonEventRow = {
  type: ProspectActivityType;
  prospectId: string;
  creditedUserId: string | null;
  creditedUserRoleAtEvent: UserRole | null;
  occurredAt: Date;
};

export type CommercialResultsEvidence = {
  /** Distinct prospects with a COMMERCIAL-role-at-event WON credited to this employee in period — the primary, de-duplicated figure (Ticket 25H.2 §15/§36). */
  creditedWins: number;
  /** The same wins before de-duplication by prospect — >= creditedWins; lets a reader see whether de-duplication actually mattered. */
  rawCreditedWinEvents: number;
  /** Wins credited to this same employee id, but with creditedUserRoleAtEvent other than COMMERCIAL (e.g. they were a MANAGER when it happened) — visible, per §17/§33, but never counted toward creditedWins. */
  excludedNonCommercialRoleWins: number;
  /** Period-wide (not scoped to this employee) count of distinct prospects with a WON_TRANSITION whose creditedUserId is null — pre-25H.1 history with unknown attribution (Ticket 25H.2 §5/§26). Never assigned to anyone. */
  legacyUnattributedWinsInPeriod: number;
  /** PARTIAL_LEGACY_ATTRIBUTION whenever legacyUnattributedWinsInPeriod > 0 — this period's picture may be incomplete company-wide, not just for this one employee. */
  coverageStatus: "COMPLETE" | "PARTIAL_LEGACY_ATTRIBUTION";
};

function distinctProspectCount(
  events: readonly CommercialResultsWonEventRow[],
): number {
  return new Set(events.map((event) => event.prospectId)).size;
}

/**
 * The "evidence retrieval" half of Ticket 25H.2 §20's fetch -> collect
 * pipeline. Takes every WON_TRANSITION row that occurred in the period
 * (company-wide, not pre-filtered to one employee) so it can report
 * legacyUnattributedWinsInPeriod honestly — a per-employee-scoped Prisma
 * query would hide that context entirely. Re-filters `type` itself
 * (defense-in-depth, same reasoning as Execution Discipline's ownership
 * re-check) so its correctness never depends on the caller's query alone.
 *
 * Eligibility for `employeeId`'s own credited wins is governed **only**
 * by `creditedUserRoleAtEvent === "COMMERCIAL"` — never by `employeeId`'s
 * current role, which this function doesn't even receive. This is
 * deliberate: Ticket 25H.2 §17/§32 requires a result credited while
 * COMMERCIAL to remain eligible after the person is later promoted to
 * MANAGER, and §33 requires the reverse (credited while MANAGER, now
 * COMMERCIAL, still excluded) — both are satisfied automatically by
 * keying purely off the frozen `creditedUserRoleAtEvent` snapshot.
 */
export function collectCommercialResultsEvidence(
  employeeId: string,
  period: CommercialResultsPeriod,
  wonTransitions: readonly CommercialResultsWonEventRow[],
): CommercialResultsEvidence {
  const inPeriod = wonTransitions.filter(
    (event) =>
      event.type === "WON_TRANSITION" &&
      event.occurredAt.getTime() >= period.periodStart.getTime() &&
      event.occurredAt.getTime() <= period.periodEnd.getTime(),
  );

  const creditedToEmployee = inPeriod.filter(
    (event) => event.creditedUserId === employeeId,
  );
  const eligible = creditedToEmployee.filter(
    (event) => event.creditedUserRoleAtEvent === "COMMERCIAL",
  );
  const excludedNonCommercial = creditedToEmployee.filter(
    (event) => event.creditedUserRoleAtEvent !== "COMMERCIAL",
  );
  const legacyUnattributed = inPeriod.filter(
    (event) => event.creditedUserId === null,
  );

  const legacyUnattributedWinsInPeriod =
    distinctProspectCount(legacyUnattributed);

  return {
    creditedWins: distinctProspectCount(eligible),
    rawCreditedWinEvents: eligible.length,
    excludedNonCommercialRoleWins: distinctProspectCount(
      excludedNonCommercial,
    ),
    legacyUnattributedWinsInPeriod,
    coverageStatus:
      legacyUnattributedWinsInPeriod > 0
        ? "PARTIAL_LEGACY_ATTRIBUTION"
        : "COMPLETE",
  };
}

export type CommercialResultsStatus =
  | "BLOCKED_PENDING_TARGET_DOMAIN"
  | "UNSUPPORTED_ROLE"
  | "PERIOD_NOT_CLOSED"
  | "EMPLOYEE_NOT_FOUND";

export const COMMERCIAL_RESULTS_SCORING_BLOCKED_REASON =
  "Results scoring requires a historically defensible denominator or " +
  "target, and neither exists in this CRM today (no Prospect assignment " +
  "history, no performance target/quota domain). Evidence is collected " +
  "and durable; the numeric /40 is intentionally not computed. See " +
  "ticket-25h2-commercial-results-score-engine.md.";

export type CommercialResultsResult =
  | {
      status: "BLOCKED_PENDING_TARGET_DOMAIN";
      score: null;
      maxScore: typeof COMMERCIAL_RESULTS_MAX_SCORE;
      scoringBlockedReason: string;
      evidence: CommercialResultsEvidence;
      policyVersion: string;
    }
  | {
      status: "UNSUPPORTED_ROLE" | "PERIOD_NOT_CLOSED" | "EMPLOYEE_NOT_FOUND";
      score: null;
      maxScore: typeof COMMERCIAL_RESULTS_MAX_SCORE;
      evidence: null;
      policyVersion: string;
    };

function notEvaluated(
  status: "UNSUPPORTED_ROLE" | "PERIOD_NOT_CLOSED" | "EMPLOYEE_NOT_FOUND",
): CommercialResultsResult {
  return {
    status,
    score: null,
    maxScore: COMMERCIAL_RESULTS_MAX_SCORE,
    evidence: null,
    policyVersion: COMMERCIAL_RESULTS_POLICY_VERSION,
  };
}

/**
 * Orchestrates Ticket 25H.2's pipeline for one employee/period, mirroring
 * Execution Discipline's shape (§20/§30: share the pattern, not the
 * implementation) — current-role eligibility, then period closure, then
 * evidence collection. Unlike Execution Discipline there is no small-
 * sample or scoring step after evidence: every successful call returns
 * BLOCKED_PENDING_TARGET_DOMAIN, by design, until a future ticket
 * introduces a real denominator or target.
 *
 * The role gate here checks the employee's *current* role — a product-
 * level decision about whether to present a Results dimension for this
 * person's profile at all today, independent of collectCommercialResultsEvidence's
 * event-time eligibility rule above. A currently-MANAGER employee's past
 * COMMERCIAL-earned evidence still exists and is still correct — call
 * collectCommercialResultsEvidence directly for that case, as a future
 * historical-record viewer would.
 */
export function computeCommercialResultsResult(
  employee: CommercialResultsEmployee,
  period: CommercialResultsPeriod,
  wonTransitions: readonly CommercialResultsWonEventRow[],
  now: Date = new Date(),
): CommercialResultsResult {
  if (!isScorableForCommercialResults(employee.role)) {
    return notEvaluated("UNSUPPORTED_ROLE");
  }

  if (period.periodEnd.getTime() > now.getTime()) {
    return notEvaluated("PERIOD_NOT_CLOSED");
  }

  const evidence = collectCommercialResultsEvidence(
    employee.id,
    period,
    wonTransitions,
  );

  return {
    status: "BLOCKED_PENDING_TARGET_DOMAIN",
    score: null,
    maxScore: COMMERCIAL_RESULTS_MAX_SCORE,
    scoringBlockedReason: COMMERCIAL_RESULTS_SCORING_BLOCKED_REASON,
    evidence,
    policyVersion: COMMERCIAL_RESULTS_POLICY_VERSION,
  };
}

/** Constructed by the service layer when the employee id doesn't resolve to a User at all — mirrors execution-discipline.service-core.ts's buildEmployeeNotFoundExecutionDisciplineResult. */
export function buildEmployeeNotFoundCommercialResultsResult(): CommercialResultsResult {
  return notEvaluated("EMPLOYEE_NOT_FOUND");
}
