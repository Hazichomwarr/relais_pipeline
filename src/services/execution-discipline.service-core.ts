import type { ProspectActionStatus, UserRole } from "@prisma/client";

/**
 * Ticket 25G found Execution Discipline to be the one performance
 * dimension the CRM can support cleanly today, and recommended starting
 * 25H there rather than on Results (blocked on WON attribution) or Daily
 * Reports (blocked on missing historical "who was expected to report"
 * evidence). This file is the pure scoring engine for that dimension —
 * no Prisma import, no role/period concerns beyond what's passed in.
 */

export const EXECUTION_DISCIPLINE_POLICY_VERSION = "EXECUTION_DISCIPLINE_V1";
export const EXECUTION_DISCIPLINE_MAX_SCORE = 30;

/**
 * Ticket 25H §15/§16: a completed-late action "still demonstrates
 * eventual execution" and must not score identically to one that was
 * never completed — but §16 explicitly rejects a lateness-magnitude
 * curve as faux precision. A single, named, revisitable partial-credit
 * weight (not a formula per day-late) is the deliberately coarse V1
 * middle ground.
 */
export const EXECUTION_DISCIPLINE_LATE_CREDIT_WEIGHT = 0.5;

/**
 * Ticket 25G §6/§27: only COMMERCIAL has audited, reliable Execution
 * Discipline evidence today — MANAGER/ADMIN have no manager-of-employee
 * hierarchy or equivalent assigned-work concept to score against. Do not
 * add roles here without a fresh audit; see 25G §6.
 */
const SCORABLE_ROLES: ReadonlySet<UserRole> = new Set(["COMMERCIAL"]);

export type ExecutionDisciplineEmployee = {
  id: string;
  role: UserRole;
};

/** An explicit, caller-supplied closed interval — never derived from "today" (Ticket 25H §4). Both bounds are inclusive. */
export type ExecutionDisciplinePeriod = {
  periodStart: Date;
  periodEnd: Date;
};

/**
 * The fields this engine actually needs from a ProspectAction row.
 * Deliberately excludes `createdByUserId`: responsibility follows
 * `assignedToUserId` alone (Ticket 25H §3/§30) — creator identity must
 * never influence scoring, and omitting the field from this type makes
 * that structurally true rather than merely convention.
 */
export type ExecutionDisciplineActionRow = {
  assignedToUserId: string;
  status: ProspectActionStatus;
  dueAt: Date;
  completedAt: Date | null;
  canceledAt: Date | null;
};

export type ExecutionDisciplineEvidence = {
  /** Actions assigned to this employee with dueAt inside the period — includes canceled ones (Ticket 25H §9: never hide the canceled count inside a shrunk denominator). */
  applicableActions: number;
  completedOnTime: number;
  completedLate: number;
  overdueOpen: number;
  canceled: number;
  /** The scoreable population: applicableActions minus canceled. Exposed so a UI never mistakes a small, canceled-thinned denominator for full confidence (Ticket 25H §13). */
  sampleSize: number;
};

export type ExecutionDisciplineStatus =
  | "SCORED"
  | "INSUFFICIENT_EVIDENCE"
  | "UNSUPPORTED_ROLE"
  | "PERIOD_NOT_CLOSED"
  | "EMPLOYEE_NOT_FOUND";

export type ExecutionDisciplineResult =
  | {
      status: "SCORED";
      score: number;
      maxScore: typeof EXECUTION_DISCIPLINE_MAX_SCORE;
      evidence: ExecutionDisciplineEvidence;
      policyVersion: string;
    }
  | {
      status: "INSUFFICIENT_EVIDENCE";
      score: null;
      maxScore: typeof EXECUTION_DISCIPLINE_MAX_SCORE;
      evidence: ExecutionDisciplineEvidence;
      policyVersion: string;
    }
  | {
      status: "UNSUPPORTED_ROLE" | "PERIOD_NOT_CLOSED" | "EMPLOYEE_NOT_FOUND";
      score: null;
      maxScore: typeof EXECUTION_DISCIPLINE_MAX_SCORE;
      evidence: null;
      policyVersion: string;
    };

function notScored(
  status: "UNSUPPORTED_ROLE" | "PERIOD_NOT_CLOSED" | "EMPLOYEE_NOT_FOUND",
): ExecutionDisciplineResult {
  return {
    status,
    score: null,
    maxScore: EXECUTION_DISCIPLINE_MAX_SCORE,
    evidence: null,
    policyVersion: EXECUTION_DISCIPLINE_POLICY_VERSION,
  };
}

/**
 * Ticket 25H §2: only a COMMERCIAL may be scored on this dimension.
 * Exported so a caller (e.g. a future results/role-responsibility engine)
 * can reuse the same eligibility rule without re-deriving it.
 */
export function isScorableForExecutionDiscipline(role: UserRole): boolean {
  return SCORABLE_ROLES.has(role);
}

/**
 * Reconstructs which bucket an action belongs in **as of `periodEnd`**,
 * not as of whenever this function happens to run. This is possible
 * without a separate history model because ProspectAction's terminal
 * fields are write-once and one-way (Ticket 20B: "Terminal actions are
 * immutable in V1 — no reopen, no edit"), and `assignedToUserId`/`dueAt`
 * are never mutated after creation (confirmed repo-wide: the only writes
 * to this model are the two guarded OPEN -> COMPLETED / OPEN -> CANCELED
 * transitions). So `completedAt`/`canceledAt`, once set, are permanent,
 * exact facts about when the action left the OPEN state — comparing them
 * against `periodEnd` reconstructs the true historical state at that
 * instant, rather than fabricating it (Ticket 25H §8).
 *
 * Concretely: an action completed *after* `periodEnd` (e.g. an August
 * action finished September 2) is still "open as of period end" for
 * this period's evidence — its eventual completion belongs to whichever
 * period contains that completion date, not this one.
 */
function classifyAsOfPeriodEnd(
  action: ExecutionDisciplineActionRow,
  periodEnd: Date,
): "completedOnTime" | "completedLate" | "overdueOpen" | "canceled" {
  if (
    action.completedAt !== null &&
    action.completedAt.getTime() <= periodEnd.getTime()
  ) {
    return action.completedAt.getTime() <= action.dueAt.getTime()
      ? "completedOnTime"
      : "completedLate";
  }

  if (
    action.canceledAt !== null &&
    action.canceledAt.getTime() <= periodEnd.getTime()
  ) {
    return "canceled";
  }

  // Not completed or canceled by period end. Population membership below
  // already guarantees dueAt <= periodEnd, so "still open at period end"
  // and "overdue at period end" are the same fact here.
  return "overdueOpen";
}

/**
 * The "normalize" step of Ticket 25H §17's fetch -> normalize -> pure
 * scoring core pipeline. Re-filters by `assignedToUserId` and period
 * membership itself rather than trusting the caller's query alone — this
 * is what makes ownership (§30) and period-boundary (§29) behavior
 * testable without a database, and gives defense-in-depth independent of
 * whatever `where` clause the service layer used.
 *
 * Period membership is decided by `dueAt` (inclusive on both ends), per
 * §5: Execution Discipline asks whether work *due* in this period was
 * executed, not when the action happened to be created.
 */
export function buildExecutionDisciplineEvidence(
  employeeId: string,
  period: ExecutionDisciplinePeriod,
  actions: readonly ExecutionDisciplineActionRow[],
): ExecutionDisciplineEvidence {
  const applicable = actions.filter(
    (action) =>
      action.assignedToUserId === employeeId &&
      action.dueAt.getTime() >= period.periodStart.getTime() &&
      action.dueAt.getTime() <= period.periodEnd.getTime(),
  );

  const evidence: ExecutionDisciplineEvidence = {
    applicableActions: applicable.length,
    completedOnTime: 0,
    completedLate: 0,
    overdueOpen: 0,
    canceled: 0,
    sampleSize: 0,
  };

  for (const action of applicable) {
    const bucket = classifyAsOfPeriodEnd(action, period.periodEnd);
    evidence[bucket] += 1;
  }

  evidence.sampleSize =
    evidence.completedOnTime + evidence.completedLate + evidence.overdueOpen;

  return evidence;
}

/**
 * The pure scoring core (Ticket 25H §17/§18): takes only evidence counts,
 * never raw actions. On-time gets full credit, late gets the partial
 * credit weight above, overdue/open gets none (§15). Canceled actions are
 * already excluded from `sampleSize` by buildExecutionDisciplineEvidence
 * (§9) — this function never sees them.
 *
 * Deterministic rounding to an integer (§19): callers must only invoke
 * this once `evidence.sampleSize > 0` — the caller (computeExecutionDisciplineResult)
 * is responsible for returning INSUFFICIENT_EVIDENCE otherwise (§14).
 */
export function computeExecutionDisciplineScore(
  evidence: Pick<
    ExecutionDisciplineEvidence,
    "completedOnTime" | "completedLate" | "sampleSize"
  >,
): number {
  const weightedCredit =
    evidence.completedOnTime +
    evidence.completedLate * EXECUTION_DISCIPLINE_LATE_CREDIT_WEIGHT;

  return Math.round(
    (EXECUTION_DISCIPLINE_MAX_SCORE * weightedCredit) / evidence.sampleSize,
  );
}

/**
 * Orchestrates the full Ticket 25H pipeline for one employee/period, in
 * the order: role eligibility (§2) -> period closure (§8) -> evidence
 * (§17) -> small-sample floor (§14) -> score (§15).
 *
 * `now` defaults to the real clock but is an explicit parameter so tests
 * stay deterministic (same convention as isOverdueProspectAction).
 * `periodEnd` in the future is refused outright (PERIOD_NOT_CLOSED)
 * rather than silently scored: classifyAsOfPeriodEnd's reconstruction is
 * only truthful once that instant has actually occurred — scoring an
 * open period would present a still-changing snapshot as if it were
 * final, which is exactly the "fabricate historical state" §8 warns
 * against, not a data limitation to work around.
 */
export function computeExecutionDisciplineResult(
  employee: ExecutionDisciplineEmployee,
  period: ExecutionDisciplinePeriod,
  actions: readonly ExecutionDisciplineActionRow[],
  now: Date = new Date(),
): ExecutionDisciplineResult {
  if (!isScorableForExecutionDiscipline(employee.role)) {
    return notScored("UNSUPPORTED_ROLE");
  }

  if (period.periodEnd.getTime() > now.getTime()) {
    return notScored("PERIOD_NOT_CLOSED");
  }

  const evidence = buildExecutionDisciplineEvidence(
    employee.id,
    period,
    actions,
  );

  if (evidence.sampleSize === 0) {
    return {
      status: "INSUFFICIENT_EVIDENCE",
      score: null,
      maxScore: EXECUTION_DISCIPLINE_MAX_SCORE,
      evidence,
      policyVersion: EXECUTION_DISCIPLINE_POLICY_VERSION,
    };
  }

  return {
    status: "SCORED",
    score: computeExecutionDisciplineScore(evidence),
    maxScore: EXECUTION_DISCIPLINE_MAX_SCORE,
    evidence,
    policyVersion: EXECUTION_DISCIPLINE_POLICY_VERSION,
  };
}

/** Constructed by the service layer when the employee id doesn't resolve to a User at all — a persistence-layer fact, not a domain-scoring one, but kept in the same result shape so callers only ever switch on one type. */
export function buildEmployeeNotFoundExecutionDisciplineResult(): ExecutionDisciplineResult {
  return notScored("EMPLOYEE_NOT_FOUND");
}
