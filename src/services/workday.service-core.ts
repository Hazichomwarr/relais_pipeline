import type { UserRole } from "@prisma/client";

import { getCurrentWorkDate } from "@/src/lib/workday-date";

/**
 * Ticket 27A/27C — the pure domain core for "Ma journée." No Prisma
 * import (matches every other *.service-core.ts in this codebase).
 *
 * Central invariant preserved throughout this file: a Workday row exists
 * if and only if the employee has declared a start (27A §2/§7, 27B's own
 * schema comment). There is exactly one function that can create a
 * Workday — startMyWorkdayCore — and nothing else in this file, or
 * anywhere else, may create one.
 */

export type WorkdayActor = {
  id: string;
  role: UserRole;
  active: boolean;
};

export type WorkdayRecord = {
  id: string;
  employeeUserId: string;
  workDate: Date;
  expectedStartTime: number;
  expectedEndTime: number;
  startedAt: Date;
  confirmedAt: Date | null;
  confirmedByUserId: string | null;
  endedAt: Date | null;
};

/**
 * The current RELAIS default working hours, in minutes since business
 * midnight (08:00 -> 480, 17:00 -> 1020). Snapshotted onto every new
 * Workday at creation time (27A §8) — never persisted as a formatted
 * string, never read live from a Schedule model (none exists). This is
 * the one dedicated location for these values (27C §10) — do not
 * hardcode 480/1020 elsewhere.
 */
export const DEFAULT_WORKDAY_EXPECTED_START_MINUTES = 8 * 60;
export const DEFAULT_WORKDAY_EXPECTED_END_MINUTES = 17 * 60;

/**
 * Ticket 27A §4/§6/§7 — MANAGER, COMMERCIAL, ASSISTANT have their own
 * workday; ADMIN does not. Deliberately a local, independent set rather
 * than importing WORKDAY_ELIGIBLE_ROLES from authorization.service-core.ts
 * — domain cores in this codebase define their own role checks rather
 * than cross-importing the route-layer authorization module (established
 * precedent: canManageCommercialPerformanceTargets in
 * commercial-performance-target.service-core.ts). The two lists must
 * agree by design, not by shared code, so either can diverge later
 * without editing the other.
 */
const WORKDAY_ELIGIBLE_ROLES: ReadonlySet<UserRole> = new Set([
  "MANAGER",
  "COMMERCIAL",
  "ASSISTANT",
]);

export function isEligibleForOwnWorkday(role: UserRole): boolean {
  return WORKDAY_ELIGIBLE_ROLES.has(role);
}

/** Same reasoning as isEligibleForOwnWorkday — the coarse actor-role gate for confirmation, independent of authorization.service-core.ts's identically-named constant. */
const WORKDAY_CONFIRMATION_ROLES: ReadonlySet<UserRole> = new Set([
  "ADMIN",
  "MANAGER",
]);

export function canAttemptWorkdayConfirmation(role: UserRole): boolean {
  return WORKDAY_CONFIRMATION_ROLES.has(role);
}

/**
 * Ticket 27A §5/§21, 27C §5 — the frozen actor/subject/self matrix. No
 * Manager->Commercial team relation exists in this codebase (27A §5/§58,
 * reconfirmed absent), so this is deliberately organization-wide, not
 * team-scoped, exactly like every other management authority in this
 * CRM that has no manager-of-employee hierarchy to narrow it.
 *
 * ADMIN -> MANAGER, COMMERCIAL, ASSISTANT : true
 * MANAGER -> COMMERCIAL, ASSISTANT        : true
 * MANAGER -> MANAGER, or self             : false
 * COMMERCIAL / ASSISTANT -> anyone        : false
 * self-confirmation, for any actor role   : false
 */
export function canConfirmWorkdayStart(
  actorRole: UserRole,
  subjectRole: UserRole,
  isSelf: boolean,
): boolean {
  if (isSelf) {
    return false;
  }

  if (actorRole === "ADMIN") {
    return (
      subjectRole === "MANAGER" ||
      subjectRole === "COMMERCIAL" ||
      subjectRole === "ASSISTANT"
    );
  }

  if (actorRole === "MANAGER") {
    return subjectRole === "COMMERCIAL" || subjectRole === "ASSISTANT";
  }

  return false;
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

export type StartWorkdayFields = {
  employeeUserId: string;
  workDate: Date;
  expectedStartTime: number;
  expectedEndTime: number;
  startedAt: Date;
};

/**
 * Ticket 27C §13/§14 — the wiring layer's `create` never throws for the
 * "someone already started today" case; it translates a unique-constraint
 * race into this outcome instead, so the core never needs Prisma-specific
 * error knowledge to interpret a lost race.
 */
export type CreateWorkdayOutcome =
  | { outcome: "CREATED"; workday: WorkdayRecord }
  | { outcome: "DUPLICATE" };

export type StartWorkdayDependencies = {
  findExisting: (
    employeeUserId: string,
    workDate: Date,
  ) => Promise<WorkdayRecord | null>;
  create: (fields: StartWorkdayFields) => Promise<CreateWorkdayOutcome>;
};

export type StartWorkdayErrorCode =
  | "NOT_ELIGIBLE"
  | "INACTIVE_USER"
  | "ALREADY_STARTED"
  | "START_FAILED";

export type StartWorkdayResult =
  | { success: true; workday: WorkdayRecord }
  | {
      success: false;
      code: "NOT_ELIGIBLE" | "INACTIVE_USER" | "START_FAILED";
      message: string;
    }
  | {
      success: false;
      code: "ALREADY_STARTED";
      message: string;
      workday: WorkdayRecord;
    };

/**
 * The one and only Workday-creation path (27A §2/§7). `actor` must
 * already be freshly resolved (id/role/active) by the caller — this core
 * never re-derives it from a session. `now` is server-controlled time,
 * injectable for deterministic tests (27C §37).
 */
export async function startMyWorkdayCore(
  actor: WorkdayActor,
  dependencies: StartWorkdayDependencies,
  now: Date = new Date(),
): Promise<StartWorkdayResult> {
  if (!actor.active) {
    return {
      success: false,
      code: "INACTIVE_USER",
      message: "Votre compte est désactivé.",
    };
  }

  if (!isEligibleForOwnWorkday(actor.role)) {
    return {
      success: false,
      code: "NOT_ELIGIBLE",
      message: "Vous n’avez pas de journée de travail à démarrer.",
    };
  }

  const workDate = getCurrentWorkDate(now);

  const existing = await dependencies.findExisting(actor.id, workDate);
  if (existing) {
    return {
      success: false,
      code: "ALREADY_STARTED",
      message: "Vous avez déjà démarré votre journée aujourd’hui.",
      workday: existing,
    };
  }

  try {
    const outcome = await dependencies.create({
      employeeUserId: actor.id,
      workDate,
      expectedStartTime: DEFAULT_WORKDAY_EXPECTED_START_MINUTES,
      expectedEndTime: DEFAULT_WORKDAY_EXPECTED_END_MINUTES,
      startedAt: now,
    });

    if (outcome.outcome === "DUPLICATE") {
      // Lost a genuine concurrent race (double-click, retry, two tabs) —
      // resolve and return the winner's real row rather than erroring
      // generically. The first successful create's startedAt is never
      // rewritten by this path.
      const raced = await dependencies.findExisting(actor.id, workDate);
      if (raced) {
        return {
          success: false,
          code: "ALREADY_STARTED",
          message: "Vous avez déjà démarré votre journée aujourd’hui.",
          workday: raced,
        };
      }
      return {
        success: false,
        code: "START_FAILED",
        message: "Impossible de démarrer votre journée. Veuillez réessayer.",
      };
    }

    return { success: true, workday: outcome.workday };
  } catch (error) {
    console.error("Unable to start workday:", error);
    return {
      success: false,
      code: "START_FAILED",
      message: "Impossible de démarrer votre journée. Veuillez réessayer.",
    };
  }
}

// ---------------------------------------------------------------------------
// End
// ---------------------------------------------------------------------------

export type EndWorkdayDependencies = {
  /** Scoped to `employeeUserId` — there is no service path capable of ending anyone else's workday (27A §26, 27C §17/§23). */
  findCurrent: (
    employeeUserId: string,
    workDate: Date,
  ) => Promise<WorkdayRecord | null>;
  endAtomically: (
    workdayId: string,
    employeeUserId: string,
    endedAt: Date,
  ) => Promise<{ count: number }>;
};

export type EndWorkdayResult =
  | { success: true; workday: WorkdayRecord }
  | {
      success: false;
      code:
        | "NOT_ELIGIBLE"
        | "INACTIVE_USER"
        | "NOT_STARTED"
        | "END_FAILED";
      message: string;
    }
  | { success: false; code: "ALREADY_ENDED"; message: string };

/**
 * Employee-self-only (27A §26/§30, 27C §23 — no Admin/Manager override
 * exists anywhere in this codebase, deliberately). Resolves the actor's
 * own Workday for *today's* RELAIS business date only — an actor cannot
 * supply an arbitrary historical work date to close (27C §17).
 */
export async function endMyWorkdayCore(
  actor: WorkdayActor,
  dependencies: EndWorkdayDependencies,
  now: Date = new Date(),
): Promise<EndWorkdayResult> {
  if (!actor.active) {
    return {
      success: false,
      code: "INACTIVE_USER",
      message: "Votre compte est désactivé.",
    };
  }

  if (!isEligibleForOwnWorkday(actor.role)) {
    return {
      success: false,
      code: "NOT_ELIGIBLE",
      message: "Vous n’avez pas de journée de travail à terminer.",
    };
  }

  const workDate = getCurrentWorkDate(now);
  const workday = await dependencies.findCurrent(actor.id, workDate);

  if (!workday) {
    return {
      success: false,
      code: "NOT_STARTED",
      message: "Vous n’avez pas encore démarré votre journée aujourd’hui.",
    };
  }

  if (workday.endedAt !== null) {
    return {
      success: false,
      code: "ALREADY_ENDED",
      message: "Vous avez déjà terminé votre journée aujourd’hui.",
    };
  }

  try {
    const result = await dependencies.endAtomically(
      workday.id,
      actor.id,
      now,
    );

    if (result.count === 0) {
      // Lost a race against a second concurrent end request — the
      // original endedAt, whichever request set it, is never overwritten
      // by this one.
      return {
        success: false,
        code: "ALREADY_ENDED",
        message: "Vous avez déjà terminé votre journée aujourd’hui.",
      };
    }

    return { success: true, workday: { ...workday, endedAt: now } };
  } catch (error) {
    console.error("Unable to end workday:", error);
    return {
      success: false,
      code: "END_FAILED",
      message: "Impossible de terminer votre journée. Veuillez réessayer.",
    };
  }
}

// ---------------------------------------------------------------------------
// Confirm
// ---------------------------------------------------------------------------

export type WorkdaySubject = {
  id: string;
  role: UserRole;
  active: boolean;
};

export type ConfirmWorkdayStartInput = {
  employeeUserId: string;
  workDate: Date;
};

export type ConfirmWorkdayStartDependencies = {
  findSubject: (employeeUserId: string) => Promise<WorkdaySubject | null>;
  findWorkday: (
    employeeUserId: string,
    workDate: Date,
  ) => Promise<WorkdayRecord | null>;
  confirmAtomically: (
    workdayId: string,
    confirmedByUserId: string,
    confirmedAt: Date,
  ) => Promise<{ count: number }>;
};

export type ConfirmWorkdayStartResult =
  | { success: true; workday: WorkdayRecord }
  | {
      success: false;
      code:
        | "INACTIVE_USER"
        | "CONFIRMATION_NOT_ALLOWED"
        | "SUBJECT_NOT_FOUND"
        | "CONFIRMATION_DATE_NOT_ALLOWED"
        | "WORKDAY_NOT_FOUND"
        | "CONFIRM_FAILED";
      message: string;
    }
  | { success: false; code: "ALREADY_CONFIRMED"; message: string };

/**
 * The management confirmation mutation (27A §9/§19-25, 27C §24-34).
 * `employeeUserId` + `workDate` are explicit, never a bare Workday id
 * (27A §81/27C §41 IDOR guidance) — this function resolves and
 * independently re-verifies the real row itself.
 *
 * Confirmation never rewrites `startedAt` — there is no code path here
 * capable of touching it. `confirmedAt`/`confirmedByUserId` are written
 * together, in one atomic guarded update, never independently (27C §58).
 *
 * Only the current RELAIS business date is confirmable: neither a past
 * date (retrospective correction, 27A §24 Option A/C rejected but no
 * cross-day backdating either way) nor a future date (27A §33) is
 * allowed — same-day confirmation after End remains valid (27A §24
 * Option B) because "today" does not change just because the employee
 * already ended.
 */
export async function confirmWorkdayStartForCore(
  actor: WorkdayActor,
  input: ConfirmWorkdayStartInput,
  dependencies: ConfirmWorkdayStartDependencies,
  now: Date = new Date(),
): Promise<ConfirmWorkdayStartResult> {
  if (!actor.active) {
    return {
      success: false,
      code: "INACTIVE_USER",
      message: "Votre compte est désactivé.",
    };
  }

  if (!canAttemptWorkdayConfirmation(actor.role)) {
    return {
      success: false,
      code: "CONFIRMATION_NOT_ALLOWED",
      message: "Vous n’avez pas le droit de confirmer une journée de travail.",
    };
  }

  const currentWorkDate = getCurrentWorkDate(now);
  if (input.workDate.getTime() !== currentWorkDate.getTime()) {
    return {
      success: false,
      code: "CONFIRMATION_DATE_NOT_ALLOWED",
      message:
        "La confirmation n’est possible que pour la journée en cours.",
    };
  }

  const subject = await dependencies.findSubject(input.employeeUserId);

  // Missing and inactive collapse to one code — mirrors
  // createCommercialPerformanceTargetCore's EMPLOYEE_NOT_FOUND: from the
  // actor's perspective, neither is a confirmable subject right now
  // (27A §34 — deny new confirmation for an inactive subject, without
  // touching any existing Workday row).
  if (!subject || !subject.active) {
    return {
      success: false,
      code: "SUBJECT_NOT_FOUND",
      message: "Cet employé est introuvable ou inactif.",
    };
  }

  if (
    !canConfirmWorkdayStart(actor.role, subject.role, actor.id === subject.id)
  ) {
    return {
      success: false,
      code: "CONFIRMATION_NOT_ALLOWED",
      message: "Vous n’avez pas le droit de confirmer cet employé.",
    };
  }

  const workday = await dependencies.findWorkday(
    input.employeeUserId,
    input.workDate,
  );

  if (!workday) {
    return {
      success: false,
      code: "WORKDAY_NOT_FOUND",
      message: "Cet employé n’a pas encore déclaré le début de sa journée.",
    };
  }

  if (workday.confirmedAt !== null) {
    return {
      success: false,
      code: "ALREADY_CONFIRMED",
      message: "Cette journée a déjà été confirmée.",
    };
  }

  try {
    const result = await dependencies.confirmAtomically(
      workday.id,
      actor.id,
      now,
    );

    if (result.count === 0) {
      // Lost a race against a second concurrent confirmation (e.g. Admin
      // and Manager confirming at once) — the winner's confirmedAt/
      // confirmedByUserId are never overwritten by this one.
      return {
        success: false,
        code: "ALREADY_CONFIRMED",
        message: "Cette journée a déjà été confirmée.",
      };
    }

    return {
      success: true,
      workday: { ...workday, confirmedAt: now, confirmedByUserId: actor.id },
    };
  } catch (error) {
    console.error("Unable to confirm workday start:", error);
    return {
      success: false,
      code: "CONFIRM_FAILED",
      message: "Impossible de confirmer cette journée. Veuillez réessayer.",
    };
  }
}
