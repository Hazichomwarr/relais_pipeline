import type { UserRole } from "@prisma/client";

import { businessLocalMidnight } from "@/src/lib/financial-report-period";

/**
 * Ticket 25H.2A — the durable comparison basis Results scoring (25H.2)
 * is blocked on: neither a historical ownership-during-period
 * denominator nor any existing target/quota concept exists in this
 * codebase (see notes/ticket-25h2-commercial-results-score-engine.md).
 * This file is the pure domain core for that target — no Prisma import.
 */

export type CommercialPerformanceTargetActor = {
  id: string;
  role: UserRole;
};

/**
 * Ticket 25H.2A §8/§9 — ADMIN and MANAGER may manage targets;
 * COMMERCIAL never manages their own. Deliberately not imported from
 * authorization.service-core.ts — domain cores in this codebase define
 * their own role checks rather than cross-importing the route-layer
 * authorization module (see canCompleteProspectAction/
 * canCancelProspectAction in prospect-action.service-core.ts for the
 * established precedent). Organization-wide, not team-scoped: no
 * manager-of-employee hierarchy exists yet (25G §6/§27) — this is a
 * documented limitation, not an oversight.
 *
 * Ticket 25P §15/§45 audit finding: this authority is deliberately left
 * untouched by 25P. Target-*management* authority (who may create/edit/
 * delete a target) and target-*subject* eligibility (who may receive one,
 * just below) are independent policies — Manager becoming a valid target
 * subject does not grant Manager any new authority, and a MANAGER already
 * had management authority before 25P for unrelated reasons (25H.2A's own
 * org-wide V1 scope). Do not merge these two constants into one generic
 * "performance roles" array (25P §45).
 */
const TARGET_MANAGEMENT_ROLES: ReadonlySet<UserRole> = new Set([
  "ADMIN",
  "MANAGER",
]);

export function canManageCommercialPerformanceTargets(actor: {
  role: UserRole;
}): boolean {
  return TARGET_MANAGEMENT_ROLES.has(actor.role);
}

/**
 * Ticket 25H.2A §3 — V1 targets existed for COMMERCIAL only, matching
 * 25H/25H.2's own Results-evidence scope at the time. Ticket 25P widens
 * this to COMMERCIAL and MANAGER, matching commercial-results.service-core.ts's
 * own RESULTS_ELIGIBLE_ROLES widening — a Manager who can now be scored
 * on Results /40 must also be a valid target subject, or NO_TARGET would
 * be permanent for every Manager. Kept as this file's own independent
 * constant rather than importing RESULTS_ELIGIBLE_ROLES from
 * commercial-results.service-core.ts (established precedent: this file
 * never imports the scoring engine, and the scoring engine's own
 * `CommercialResultsTarget.roleAtAssignment` check likewise never imports
 * this file) — the two policies currently agree by design, not by
 * shared code, so either can diverge later without editing the other.
 */
const ELIGIBLE_EMPLOYEE_ROLES: ReadonlySet<UserRole> = new Set([
  "COMMERCIAL",
  "MANAGER",
]);

/**
 * Exported so the employee-listing query that populates the target-
 * creation dropdown (user.service.ts) can filter by this exact policy
 * instead of duplicating the role literals (Ticket 25P §34).
 */
export const COMMERCIAL_PERFORMANCE_TARGET_ELIGIBLE_ROLES: readonly UserRole[] =
  Array.from(ELIGIBLE_EMPLOYEE_ROLES);

export function isEligibleForCommercialPerformanceTarget(
  role: UserRole,
): boolean {
  return ELIGIBLE_EMPLOYEE_ROLES.has(role);
}

/** `month` is 1-12 (human-friendly, matches how a UI would present "Septembre 2026") — never 0-indexed like JS's native Date.getMonth(). */
export type CommercialPerformanceTargetMonth = {
  year: number;
  month: number;
};

export type CommercialPerformanceTargetPeriod = {
  periodStart: Date;
  periodEnd: Date;
};

/**
 * The canonical calendar-month boundary in RELAIS's business timezone,
 * both bounds inclusive (matching 25H/25H.2's period convention). Reuses
 * financial-report-period.ts's businessLocalMidnight rather than
 * re-deriving the timezone offset math (§12: do not introduce a new
 * timezone framework) — the same business-day/month arithmetic
 * resolveFinancialReportPeriod's "month" case already uses for RELAIS's
 * live reporting.
 *
 * This is the *only* way a period is ever produced for this domain — a
 * caller supplies a `{year, month}`, never an arbitrary periodStart/
 * periodEnd pair, so the @@unique([userId, periodStart, periodEnd])
 * constraint reliably means "one target per employee per calendar
 * month," never an accidentally-overlapping custom range (§11).
 */
export function resolveCommercialPerformanceTargetPeriod(
  month: CommercialPerformanceTargetMonth,
): CommercialPerformanceTargetPeriod {
  const monthIndex = month.month - 1;
  const periodStart = businessLocalMidnight(month.year, monthIndex, 1);
  const periodEndExclusive = businessLocalMidnight(
    month.year,
    monthIndex + 1,
    1,
  );

  return {
    periodStart,
    periodEnd: new Date(periodEndExclusive.getTime() - 1),
  };
}

/**
 * Ticket 25H.2A §16 — freeze-before-period semantics (Option A, no
 * revision history): a target is editable/deletable only while its
 * period hasn't begun yet. Once `now >= periodStart`, it is locked,
 * including the exact instant `now === periodStart` (§54's boundary
 * test) — creation "at" the boundary is already too late, not a grace
 * instant.
 */
export function isCommercialPerformanceTargetPeriodLocked(
  periodStart: Date,
  now: Date = new Date(),
): boolean {
  return now.getTime() >= periodStart.getTime();
}

export type CommercialPerformanceTargetErrorCode =
  | "ACCESS_DENIED"
  | "INVALID_TARGET_VALUE"
  | "EMPLOYEE_NOT_FOUND"
  | "EMPLOYEE_NOT_ELIGIBLE"
  | "PERIOD_ALREADY_STARTED"
  | "DUPLICATE_PERIOD"
  | "CREATE_FAILED"
  | "NOT_FOUND"
  | "TARGET_LOCKED"
  | "UPDATE_FAILED"
  | "DELETE_FAILED";

function isValidTargetWins(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export type CommercialPerformanceTargetEmployeeRecord = {
  id: string;
  role: UserRole;
  active: boolean;
};

export type CreateCommercialPerformanceTargetInput = {
  userId: string;
  month: CommercialPerformanceTargetMonth;
  targetWins: number;
};

export type CreateCommercialPerformanceTargetResult =
  | { success: true; targetId: string }
  | {
      success: false;
      code: CommercialPerformanceTargetErrorCode;
      message: string;
    };

export type CreateCommercialPerformanceTargetFields = {
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  targetWins: number;
  roleAtAssignment: UserRole;
  createdByUserId: string;
  createdByRoleAtEvent: UserRole;
};

export type CreateCommercialPerformanceTargetDependencies = {
  findEmployee: (
    userId: string,
  ) => Promise<CommercialPerformanceTargetEmployeeRecord | null>;
  findExisting: (
    userId: string,
    periodStart: Date,
    periodEnd: Date,
  ) => Promise<{ id: string } | null>;
  create: (
    fields: CreateCommercialPerformanceTargetFields,
  ) => Promise<{ id: string }>;
};

/**
 * Ticket 25H.2A §9/§44 — `actor` must come from the authenticated
 * session, never client-supplied input; `employee.role`/`active` are
 * read fresh from `findEmployee`, never trusted from the caller. Rule
 * order: authorization, then input shape, then period closure (cheap,
 * no I/O), then the two I/O-backed checks (employee eligibility,
 * duplicate period) — cheapest/most-decisive checks first, same
 * ordering discipline as completeProspectActionCore.
 */
export async function createCommercialPerformanceTargetCore(
  actor: CommercialPerformanceTargetActor,
  input: CreateCommercialPerformanceTargetInput,
  dependencies: CreateCommercialPerformanceTargetDependencies,
  now: Date = new Date(),
): Promise<CreateCommercialPerformanceTargetResult> {
  if (!canManageCommercialPerformanceTargets(actor)) {
    return {
      success: false,
      code: "ACCESS_DENIED",
      message:
        "Vous n’avez pas le droit de définir des objectifs commerciaux.",
    };
  }

  if (!isValidTargetWins(input.targetWins)) {
    return {
      success: false,
      code: "INVALID_TARGET_VALUE",
      message: "L’objectif doit être un nombre entier positif.",
    };
  }

  const { periodStart, periodEnd } = resolveCommercialPerformanceTargetPeriod(
    input.month,
  );

  if (isCommercialPerformanceTargetPeriodLocked(periodStart, now)) {
    return {
      success: false,
      code: "PERIOD_ALREADY_STARTED",
      message:
        "Impossible de créer un objectif pour une période déjà commencée.",
    };
  }

  const employee = await dependencies.findEmployee(input.userId);

  // Missing and inactive collapse to one code — mirrors
  // createProspectActionCore's ASSIGNEE_NOT_AVAILABLE for the same reason:
  // from the caller's perspective, neither is a valid target subject.
  if (!employee || !employee.active) {
    return {
      success: false,
      code: "EMPLOYEE_NOT_FOUND",
      message: "Cet employé est introuvable ou inactif.",
    };
  }

  if (!isEligibleForCommercialPerformanceTarget(employee.role)) {
    return {
      success: false,
      code: "EMPLOYEE_NOT_ELIGIBLE",
      message:
        "Seuls les commerciaux et les managers peuvent recevoir un objectif de résultats.",
    };
  }

  const existing = await dependencies.findExisting(
    input.userId,
    periodStart,
    periodEnd,
  );

  if (existing) {
    return {
      success: false,
      code: "DUPLICATE_PERIOD",
      message: "Un objectif existe déjà pour cet employé sur cette période.",
    };
  }

  try {
    const target = await dependencies.create({
      userId: input.userId,
      periodStart,
      periodEnd,
      targetWins: input.targetWins,
      roleAtAssignment: employee.role,
      createdByUserId: actor.id,
      createdByRoleAtEvent: actor.role,
    });

    return { success: true, targetId: target.id };
  } catch (error) {
    console.error("Unable to create commercial performance target:", error);
    return {
      success: false,
      code: "CREATE_FAILED",
      message: "L’objectif n’a pas pu être créé. Veuillez réessayer.",
    };
  }
}

// ---------------------------------------------------------------------------
// Update (targetWins only, before lock — Ticket 25H.2A §33)
// ---------------------------------------------------------------------------

export type CommercialPerformanceTargetRow = {
  id: string;
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  targetWins: number;
  // Ticket 25H.2B — the Results score engine's own defensive re-check
  // (see CommercialResultsTarget in commercial-results.service-core.ts)
  // needs this snapshot too; included here so getCommercialPerformanceTargetCore
  // stays the one authoritative read model rather than a second query
  // being written just to fetch one extra column.
  roleAtAssignment: UserRole;
};

export type UpdateCommercialPerformanceTargetResult =
  | { success: true }
  | {
      success: false;
      code: CommercialPerformanceTargetErrorCode;
      message: string;
    };

export type UpdateCommercialPerformanceTargetDependencies = {
  findById: (
    targetId: string,
  ) => Promise<CommercialPerformanceTargetRow | null>;
  update: (targetId: string, targetWins: number) => Promise<void>;
};

export async function updateCommercialPerformanceTargetCore(
  actor: CommercialPerformanceTargetActor,
  targetId: string,
  targetWins: number,
  dependencies: UpdateCommercialPerformanceTargetDependencies,
  now: Date = new Date(),
): Promise<UpdateCommercialPerformanceTargetResult> {
  if (!canManageCommercialPerformanceTargets(actor)) {
    return {
      success: false,
      code: "ACCESS_DENIED",
      message:
        "Vous n’avez pas le droit de modifier les objectifs commerciaux.",
    };
  }

  if (!isValidTargetWins(targetWins)) {
    return {
      success: false,
      code: "INVALID_TARGET_VALUE",
      message: "L’objectif doit être un nombre entier positif.",
    };
  }

  const target = await dependencies.findById(targetId);

  if (!target) {
    return {
      success: false,
      code: "NOT_FOUND",
      message: "Cet objectif est introuvable.",
    };
  }

  if (isCommercialPerformanceTargetPeriodLocked(target.periodStart, now)) {
    return {
      success: false,
      code: "TARGET_LOCKED",
      message:
        "Les objectifs sont verrouillés une fois la période commencée afin de préserver l’historique de l’évaluation.",
    };
  }

  try {
    await dependencies.update(targetId, targetWins);
    return { success: true };
  } catch (error) {
    console.error("Unable to update commercial performance target:", error);
    return {
      success: false,
      code: "UPDATE_FAILED",
      message: "L’objectif n’a pas pu être modifié. Veuillez réessayer.",
    };
  }
}

// ---------------------------------------------------------------------------
// Delete (before lock only — Ticket 25H.2A §21/§34)
// ---------------------------------------------------------------------------

export type DeleteCommercialPerformanceTargetResult =
  | { success: true }
  | {
      success: false;
      code: CommercialPerformanceTargetErrorCode;
      message: string;
    };

export type DeleteCommercialPerformanceTargetDependencies = {
  findById: (
    targetId: string,
  ) => Promise<{ id: string; periodStart: Date } | null>;
  delete: (targetId: string) => Promise<void>;
};

export async function deleteCommercialPerformanceTargetCore(
  actor: CommercialPerformanceTargetActor,
  targetId: string,
  dependencies: DeleteCommercialPerformanceTargetDependencies,
  now: Date = new Date(),
): Promise<DeleteCommercialPerformanceTargetResult> {
  if (!canManageCommercialPerformanceTargets(actor)) {
    return {
      success: false,
      code: "ACCESS_DENIED",
      message:
        "Vous n’avez pas le droit de supprimer les objectifs commerciaux.",
    };
  }

  const target = await dependencies.findById(targetId);

  if (!target) {
    return {
      success: false,
      code: "NOT_FOUND",
      message: "Cet objectif est introuvable.",
    };
  }

  if (isCommercialPerformanceTargetPeriodLocked(target.periodStart, now)) {
    return {
      success: false,
      code: "TARGET_LOCKED",
      message:
        "Impossible de supprimer un objectif dont la période a déjà commencé.",
    };
  }

  try {
    await dependencies.delete(targetId);
    return { success: true };
  } catch (error) {
    console.error("Unable to delete commercial performance target:", error);
    return {
      success: false,
      code: "DELETE_FAILED",
      message: "L’objectif n’a pas pu être supprimé. Veuillez réessayer.",
    };
  }
}

// ---------------------------------------------------------------------------
// Read (exact lookup only — Ticket 25H.2A §31/§60/§61)
// ---------------------------------------------------------------------------

export type GetCommercialPerformanceTargetDependencies = {
  findExact: (
    userId: string,
    periodStart: Date,
    periodEnd: Date,
  ) => Promise<CommercialPerformanceTargetRow | null>;
};

/**
 * Exact-period lookup only — no "latest target," no "previous month"
 * fallback. A period with no matching row returns `null`; that absence
 * is the truth this domain represents, never silently substituted.
 */
export async function getCommercialPerformanceTargetCore(
  userId: string,
  period: CommercialPerformanceTargetPeriod,
  dependencies: GetCommercialPerformanceTargetDependencies,
): Promise<CommercialPerformanceTargetRow | null> {
  return dependencies.findExact(userId, period.periodStart, period.periodEnd);
}
