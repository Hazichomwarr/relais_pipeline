import type { ProspectActivityType, UserRole } from "@prisma/client";

import { type ExecutionDisciplinePeriod } from "@/src/services/execution-discipline.service-core";

/**
 * Ticket 25H.2 built the evidence collector (collectCommercialResultsEvidence)
 * after finding neither a historically durable ownership-during-period
 * denominator nor any existing target/quota domain — see
 * notes/ticket-25h2-commercial-results-score-engine.md. 25H.2A then built
 * that missing target domain
 * (commercial-performance-target.service-core.ts). This file's scoring
 * half (computeCommercialResultsScore/computeCommercialResultsResult) is
 * Ticket 25H.2B, combining the two into a real `/40` — but only when the
 * period's evidence coverage is complete and an exact, valid target
 * exists; otherwise it still refuses to fabricate a number.
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

/**
 * The one target-domain fact this file needs (Ticket 25H.2B §5/§20) —
 * deliberately narrower than commercial-performance-target.service-core.ts's
 * full CommercialPerformanceTargetRow, since scoring only ever reads
 * these two fields. `roleAtAssignment` is re-validated defensively here
 * (§5) even though 25H.2A's write path already guarantees it's always
 * "COMMERCIAL" — this file never trusts a table name alone.
 */
export type CommercialResultsTarget = {
  targetWins: number;
  roleAtAssignment: UserRole;
};

export type CommercialResultsStatus =
  | "SCORED"
  | "NO_TARGET"
  | "INVALID_TARGET"
  | "LEGACY_ATTRIBUTION_INCOMPLETE"
  | "UNSUPPORTED_ROLE"
  | "PERIOD_NOT_CLOSED"
  | "EMPLOYEE_NOT_FOUND";

export type CommercialResultsResult =
  | {
      status: "SCORED";
      score: number;
      maxScore: typeof COMMERCIAL_RESULTS_MAX_SCORE;
      achievementRate: number;
      targetWins: number;
      creditedWins: number;
      coverageStatus: "COMPLETE";
      evidence: CommercialResultsEvidence;
      policyVersion: string;
    }
  | {
      status: "LEGACY_ATTRIBUTION_INCOMPLETE";
      score: null;
      maxScore: typeof COMMERCIAL_RESULTS_MAX_SCORE;
      legacyUnattributedWinsInPeriod: number;
      evidence: CommercialResultsEvidence;
      policyVersion: string;
    }
  | {
      status: "NO_TARGET";
      score: null;
      maxScore: typeof COMMERCIAL_RESULTS_MAX_SCORE;
      evidence: CommercialResultsEvidence;
      policyVersion: string;
    }
  | {
      status:
        | "INVALID_TARGET"
        | "UNSUPPORTED_ROLE"
        | "PERIOD_NOT_CLOSED"
        | "EMPLOYEE_NOT_FOUND";
      score: null;
      maxScore: typeof COMMERCIAL_RESULTS_MAX_SCORE;
      evidence: null;
      policyVersion: string;
    };

function notEvaluated(
  status:
    | "INVALID_TARGET"
    | "UNSUPPORTED_ROLE"
    | "PERIOD_NOT_CLOSED"
    | "EMPLOYEE_NOT_FOUND",
): CommercialResultsResult {
  return {
    status,
    score: null,
    maxScore: COMMERCIAL_RESULTS_MAX_SCORE,
    evidence: null,
    policyVersion: COMMERCIAL_RESULTS_POLICY_VERSION,
  };
}

export type CommercialResultsScoreInput = {
  creditedWins: number;
  targetWins: number;
};

/**
 * The pure score core (Ticket 25H.2B §1/§19): caps at 40, never exceeds
 * it regardless of overachievement. Precondition: `targetWins > 0` —
 * callers must guard first (computeCommercialResultsResult's
 * INVALID_TARGET check is that guard); this function does not defend
 * against zero/negative itself, so it is never called with one.
 */
export function computeCommercialResultsScore(
  input: CommercialResultsScoreInput,
): number {
  const raw =
    (COMMERCIAL_RESULTS_MAX_SCORE * input.creditedWins) / input.targetWins;

  return Math.min(COMMERCIAL_RESULTS_MAX_SCORE, Math.round(raw));
}

/**
 * A raw, unclamped decimal ratio (e.g. `1.75` for 7 wins against a
 * target of 4, `10` for 10 against 1) — not a `conversionRate`-style
 * percentage (×100). This is a deliberate deviation from that existing
 * convention: the ticket's own worked test examples (§16 "achievementRate
 * = 1.75", §33 "achievementRate 10") are unambiguous about the decimal
 * form, so they take precedence over inferring a percentage from an
 * unrelated existing helper. A future UI can multiply by 100 to display
 * a percentage; this value never clamps to 1.0 (§16: "the score caps;
 * achievement evidence does not").
 */
export function computeCommercialResultsAchievementRate(
  input: CommercialResultsScoreInput,
): number {
  return input.creditedWins / input.targetWins;
}

/**
 * Orchestrates Ticket 25H.2B's full pipeline for one employee/period:
 * current-role eligibility, period closure, evidence collection, then —
 * only once evidence coverage is trustworthy and an exact, valid target
 * exists — the score itself. Mirrors Execution Discipline's shape
 * (§20/§30: share the pattern, not the implementation).
 *
 * `target` is a plain, already-resolved value (never a Prisma call) —
 * this function stays pure, per §19; the service layer is responsible
 * for calling getCommercialPerformanceTarget and passing the result in,
 * exactly once, per §2's "no fallback" / §26's "strictly read-only"
 * rules.
 *
 * Check order matters: coverage is evaluated *before* target lookup, so
 * a period with incomplete legacy attribution is flagged
 * LEGACY_ATTRIBUTION_INCOMPLETE even when a valid target exists (§9/§38)
 * — an incomplete historical picture is disqualifying on its own, not
 * merely "missing a comparison basis."
 *
 * The role gate checks the employee's *current* role — a product-level
 * decision about whether to present a Results dimension for this
 * person's profile at all today, independent of
 * collectCommercialResultsEvidence's event-time eligibility rule. A
 * currently-MANAGER employee's past COMMERCIAL-earned evidence still
 * exists and is still correct — call collectCommercialResultsEvidence
 * directly for that case, as a future historical-record viewer would
 * (§4/§24, unchanged from 25H.2's own reasoning).
 */
export function computeCommercialResultsResult(
  employee: CommercialResultsEmployee,
  period: CommercialResultsPeriod,
  wonTransitions: readonly CommercialResultsWonEventRow[],
  target: CommercialResultsTarget | null,
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

  if (evidence.coverageStatus === "PARTIAL_LEGACY_ATTRIBUTION") {
    return {
      status: "LEGACY_ATTRIBUTION_INCOMPLETE",
      score: null,
      maxScore: COMMERCIAL_RESULTS_MAX_SCORE,
      legacyUnattributedWinsInPeriod: evidence.legacyUnattributedWinsInPeriod,
      evidence,
      policyVersion: COMMERCIAL_RESULTS_POLICY_VERSION,
    };
  }

  if (!target) {
    return {
      status: "NO_TARGET",
      score: null,
      maxScore: COMMERCIAL_RESULTS_MAX_SCORE,
      evidence,
      policyVersion: COMMERCIAL_RESULTS_POLICY_VERSION,
    };
  }

  if (
    target.roleAtAssignment !== "COMMERCIAL" ||
    !Number.isInteger(target.targetWins) ||
    target.targetWins <= 0
  ) {
    return notEvaluated("INVALID_TARGET");
  }

  const scoreInput: CommercialResultsScoreInput = {
    creditedWins: evidence.creditedWins,
    targetWins: target.targetWins,
  };

  return {
    status: "SCORED",
    score: computeCommercialResultsScore(scoreInput),
    maxScore: COMMERCIAL_RESULTS_MAX_SCORE,
    achievementRate: computeCommercialResultsAchievementRate(scoreInput),
    targetWins: target.targetWins,
    creditedWins: evidence.creditedWins,
    coverageStatus: "COMPLETE",
    evidence,
    policyVersion: COMMERCIAL_RESULTS_POLICY_VERSION,
  };
}

/** Constructed by the service layer when the employee id doesn't resolve to a User at all — mirrors execution-discipline.service-core.ts's buildEmployeeNotFoundExecutionDisciplineResult. */
export function buildEmployeeNotFoundCommercialResultsResult(): CommercialResultsResult {
  return notEvaluated("EMPLOYEE_NOT_FOUND");
}
