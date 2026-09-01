import type { DailyTaskStatus, UserRole } from "@prisma/client";

import { getCurrentWorkDate } from "@/src/lib/workday-date";

/**
 * Ticket 27A/27E — the pure domain core for "Tâches du jour." No Prisma
 * import (matches every other *.service-core.ts in this codebase).
 *
 * Central invariant preserved throughout this file: DailyTask is
 * structurally independent of Workday (27A §7, 27D's own schema
 * comment) — no `workdayId`, no Workday relation. The two domains are
 * joined only operationally, at mutation time, via `employeeUserId` +
 * `workDate` — never by a foreign key. `getCurrentWorkDate` is imported
 * from workday-date.ts because it is the shared RELAIS business-date
 * primitive (itself a thin delegation to financial-report-period.ts),
 * not a Workday-domain dependency — the same reasoning
 * commercial-performance-target.service-core.ts already documents for
 * importing businessLocalMidnight.
 */

export type DailyTaskActor = {
  id: string;
  role: UserRole;
  active: boolean;
};

export type DailyTaskSubject = {
  id: string;
  role: UserRole;
  active: boolean;
};

export type DailyTaskRecord = {
  id: string;
  workDate: Date;
  assignedToUserId: string;
  assignedByUserId: string;
  content: string;
  assignedAt: Date;
  status: DailyTaskStatus;
  completedAt: Date | null;
  cancellationReason: string | null;
};

/** The minimum a Workday-boundary check needs — deliberately not the full WorkdayRecord shape, to keep this file from importing anything Workday-domain-specific even at the type level. */
export type WorkdayOpenState = {
  endedAt: Date | null;
};

/**
 * Ticket 27A §32, 27E §3 — MANAGER, COMMERCIAL may receive a DailyTask.
 * Deliberately a local, independent set rather than importing
 * DAILY_TASK_RECIPIENT_ROLES from authorization.service-core.ts — domain
 * cores in this codebase define their own role checks rather than
 * cross-importing the route-layer authorization module (established
 * precedent: isEligibleForOwnWorkday in workday.service-core.ts,
 * canManageCommercialPerformanceTargets in
 * commercial-performance-target.service-core.ts). The two lists must
 * agree by design, not by shared code.
 */
const DAILY_TASK_RECIPIENT_ROLES: ReadonlySet<UserRole> = new Set([
  "MANAGER",
  "COMMERCIAL",
]);

export function isEligibleDailyTaskRecipient(role: UserRole): boolean {
  return DAILY_TASK_RECIPIENT_ROLES.has(role);
}

/** Same reasoning as isEligibleDailyTaskRecipient — the coarse actor-role gate for assignment/cancellation, independent of authorization.service-core.ts's identically-named constant. */
const TASK_ASSIGNMENT_ROLES: ReadonlySet<UserRole> = new Set([
  "ADMIN",
  "MANAGER",
]);

export function canAttemptTaskAssignment(role: UserRole): boolean {
  return TASK_ASSIGNMENT_ROLES.has(role);
}

/**
 * Ticket 27A §33, 27E §5 — the frozen actor/subject/self matrix.
 *
 * ADMIN   -> MANAGER, COMMERCIAL      : true
 * ADMIN   -> ASSISTANT, ADMIN         : false
 * MANAGER -> COMMERCIAL               : true
 * MANAGER -> MANAGER, ASSISTANT, ADMIN, or self : false
 * COMMERCIAL / ASSISTANT -> anyone    : false
 *
 * No Manager->Commercial team relation exists in this codebase (27A
 * §5/§58, reconfirmed absent) — organization-wide, not team-scoped,
 * exactly like Workday confirmation authority.
 */
export function canAssignTask(
  actorRole: UserRole,
  subjectRole: UserRole,
  isSelf: boolean,
): boolean {
  if (isSelf) {
    return false;
  }

  if (actorRole === "ADMIN") {
    return subjectRole === "MANAGER" || subjectRole === "COMMERCIAL";
  }

  if (actorRole === "MANAGER") {
    return subjectRole === "COMMERCIAL";
  }

  return false;
}

/**
 * Ticket 27E §1/§40 — the frozen V1 cancellation-authority policy, the
 * one question 27A left explicitly open. ADMIN may cancel any OPEN task;
 * MANAGER may cancel only a task they themselves originally assigned —
 * never another Manager's, even though Manager authority elsewhere in
 * this domain is organization-wide. This is an authority override at
 * cancellation time, never a rewrite of `assignedByUserId` — an ADMIN
 * cancelling a Manager-created task does not become its assignor.
 */
export function canCancelTask(input: {
  actorRole: UserRole;
  actorUserId: string;
  assignedByUserId: string;
}): boolean {
  if (input.actorRole === "ADMIN") {
    return true;
  }

  if (input.actorRole === "MANAGER") {
    return input.actorUserId === input.assignedByUserId;
  }

  return false;
}

function isSameBusinessDate(left: Date, right: Date): boolean {
  return left.getTime() === right.getTime();
}

// ---------------------------------------------------------------------------
// Assign
// ---------------------------------------------------------------------------

export type AssignTaskInput = {
  assignedToUserId: string;
  /** Already business-midnight normalized by the caller (wiring/action layer), matching Workday's own convention — this core never re-normalizes it. */
  workDate: Date;
  content: string;
};

export type AssignTaskFields = {
  workDate: Date;
  assignedToUserId: string;
  assignedByUserId: string;
  content: string;
  assignedAt: Date;
};

export type AssignTaskDependencies = {
  findSubject: (assignedToUserId: string) => Promise<DailyTaskSubject | null>;
  /** Only consulted when input.workDate is today (27A §17/§44 — future-date assignment has no Workday requirement at all). */
  findWorkdayOpenState: (
    assignedToUserId: string,
    workDate: Date,
  ) => Promise<WorkdayOpenState | null>;
  create: (fields: AssignTaskFields) => Promise<DailyTaskRecord>;
};

export type AssignTaskErrorCode =
  | "INACTIVE_USER"
  | "NOT_AUTHORIZED"
  | "RECIPIENT_NOT_ELIGIBLE"
  | "PAST_DATE_NOT_ALLOWED"
  | "WORKDAY_ALREADY_ENDED"
  | "ASSIGN_FAILED";

export type AssignTaskResult =
  | { success: true; task: DailyTaskRecord }
  | { success: false; code: AssignTaskErrorCode; message: string };

/**
 * `actor` must already be freshly resolved (id/role/active) by the
 * caller — this core never re-derives it from a session. Duplicate
 * identical assignments are never checked for and never rejected (27A
 * §21/§72 of the audit — equivalent task creation is not a concurrency
 * conflict), so there is no uniqueness dependency here at all, unlike
 * Workday's start.
 */
export async function assignTaskCore(
  actor: DailyTaskActor,
  input: AssignTaskInput,
  dependencies: AssignTaskDependencies,
  now: Date = new Date(),
): Promise<AssignTaskResult> {
  if (!actor.active) {
    return {
      success: false,
      code: "INACTIVE_USER",
      message: "Votre compte est désactivé.",
    };
  }

  if (!canAttemptTaskAssignment(actor.role)) {
    return {
      success: false,
      code: "NOT_AUTHORIZED",
      message: "Vous n’avez pas le droit d’assigner une tâche.",
    };
  }

  const today = getCurrentWorkDate(now);

  if (input.workDate.getTime() < today.getTime()) {
    return {
      success: false,
      code: "PAST_DATE_NOT_ALLOWED",
      message: "Impossible d’assigner une tâche pour une date déjà passée.",
    };
  }

  const subject = await dependencies.findSubject(input.assignedToUserId);

  if (!subject || !subject.active || !isEligibleDailyTaskRecipient(subject.role)) {
    return {
      success: false,
      code: "RECIPIENT_NOT_ELIGIBLE",
      message: "Cet employé ne peut pas recevoir de tâche.",
    };
  }

  if (!canAssignTask(actor.role, subject.role, actor.id === subject.id)) {
    return {
      success: false,
      code: "NOT_AUTHORIZED",
      message: "Vous n’avez pas le droit d’assigner une tâche à cet employé.",
    };
  }

  if (isSameBusinessDate(input.workDate, today)) {
    const workday = await dependencies.findWorkdayOpenState(
      input.assignedToUserId,
      today,
    );
    if (workday && workday.endedAt !== null) {
      return {
        success: false,
        code: "WORKDAY_ALREADY_ENDED",
        message:
          "Impossible d’assigner une nouvelle tâche : la journée de cet employé est déjà terminée.",
      };
    }
  }

  try {
    const task = await dependencies.create({
      workDate: input.workDate,
      assignedToUserId: input.assignedToUserId,
      assignedByUserId: actor.id,
      content: input.content,
      assignedAt: now,
    });

    return { success: true, task };
  } catch (error) {
    console.error("Unable to assign daily task:", error);
    return {
      success: false,
      code: "ASSIGN_FAILED",
      message: "Impossible d’assigner cette tâche. Veuillez réessayer.",
    };
  }
}

// ---------------------------------------------------------------------------
// Complete / Uncomplete
// ---------------------------------------------------------------------------

function resolveLostRaceCode(
  task: DailyTaskRecord | null,
): "TASK_ALREADY_COMPLETED" | "TASK_CANCELLED" | null {
  if (!task) {
    return null;
  }
  if (task.status === "COMPLETED") {
    return "TASK_ALREADY_COMPLETED";
  }
  if (task.status === "CANCELLED") {
    return "TASK_CANCELLED";
  }
  return null;
}

export type CompleteMyTaskDependencies = {
  findTask: (taskId: string) => Promise<DailyTaskRecord | null>;
  findWorkdayOpenState: (
    employeeUserId: string,
    workDate: Date,
  ) => Promise<WorkdayOpenState | null>;
  completeAtomically: (
    taskId: string,
    assignedToUserId: string,
    completedAt: Date,
  ) => Promise<{ count: number }>;
};

export type CompleteMyTaskErrorCode =
  | "INACTIVE_USER"
  | "NOT_AUTHORIZED"
  | "TASK_NOT_FOUND"
  | "NOT_TASK_OWNER"
  | "TASK_ALREADY_COMPLETED"
  | "TASK_CANCELLED"
  | "TASK_NOT_FOR_TODAY"
  | "WORKDAY_NOT_STARTED"
  | "WORKDAY_ALREADY_ENDED"
  | "COMPLETE_FAILED";

export type CompleteMyTaskResult =
  | { success: true; task: DailyTaskRecord }
  | { success: false; code: CompleteMyTaskErrorCode; message: string };

/**
 * Ownership (`task.assignedToUserId === actor.id`) is the primary IDOR
 * boundary (27A §25/§41) — checked before task state, so a cross-user
 * attempt is denied uniformly regardless of the task's status. Requires
 * the task's own workDate to equal today, AND a matching Workday that
 * exists and is still open (27A §29/§30) — this is a lifecycle query at
 * mutation time only, never a stored relationship.
 */
export async function completeMyTaskCore(
  actor: DailyTaskActor,
  taskId: string,
  dependencies: CompleteMyTaskDependencies,
  now: Date = new Date(),
): Promise<CompleteMyTaskResult> {
  if (!actor.active) {
    return {
      success: false,
      code: "INACTIVE_USER",
      message: "Votre compte est désactivé.",
    };
  }

  if (!isEligibleDailyTaskRecipient(actor.role)) {
    return {
      success: false,
      code: "NOT_AUTHORIZED",
      message: "Vous n’avez pas de tâches à compléter.",
    };
  }

  const task = await dependencies.findTask(taskId);

  if (!task) {
    return {
      success: false,
      code: "TASK_NOT_FOUND",
      message: "Cette tâche est introuvable.",
    };
  }

  if (task.assignedToUserId !== actor.id) {
    return {
      success: false,
      code: "NOT_TASK_OWNER",
      message: "Cette tâche ne vous est pas assignée.",
    };
  }

  if (task.status === "COMPLETED") {
    return {
      success: false,
      code: "TASK_ALREADY_COMPLETED",
      message: "Cette tâche est déjà terminée.",
    };
  }

  if (task.status === "CANCELLED") {
    return {
      success: false,
      code: "TASK_CANCELLED",
      message: "Cette tâche a été annulée.",
    };
  }

  const today = getCurrentWorkDate(now);

  if (!isSameBusinessDate(task.workDate, today)) {
    return {
      success: false,
      code: "TASK_NOT_FOR_TODAY",
      message: "Cette tâche n’est pas celle du jour.",
    };
  }

  const workday = await dependencies.findWorkdayOpenState(actor.id, today);

  if (!workday) {
    return {
      success: false,
      code: "WORKDAY_NOT_STARTED",
      message: "Démarrez votre journée avant de compléter une tâche.",
    };
  }

  if (workday.endedAt !== null) {
    return {
      success: false,
      code: "WORKDAY_ALREADY_ENDED",
      message: "Votre journée est terminée : les tâches ne sont plus modifiables.",
    };
  }

  try {
    const result = await dependencies.completeAtomically(taskId, actor.id, now);

    if (result.count === 0) {
      const raced = await dependencies.findTask(taskId);
      const code = resolveLostRaceCode(raced) ?? "TASK_ALREADY_COMPLETED";
      return {
        success: false,
        code,
        message:
          code === "TASK_CANCELLED"
            ? "Cette tâche a été annulée."
            : "Cette tâche est déjà terminée.",
      };
    }

    return {
      success: true,
      task: { ...task, status: "COMPLETED", completedAt: now },
    };
  } catch (error) {
    console.error("Unable to complete daily task:", error);
    return {
      success: false,
      code: "COMPLETE_FAILED",
      message: "Impossible de compléter cette tâche. Veuillez réessayer.",
    };
  }
}

export type UncompleteMyTaskDependencies = {
  findTask: (taskId: string) => Promise<DailyTaskRecord | null>;
  findWorkdayOpenState: (
    employeeUserId: string,
    workDate: Date,
  ) => Promise<WorkdayOpenState | null>;
  uncompleteAtomically: (
    taskId: string,
    assignedToUserId: string,
  ) => Promise<{ count: number }>;
};

export type UncompleteMyTaskErrorCode =
  | "INACTIVE_USER"
  | "NOT_AUTHORIZED"
  | "TASK_NOT_FOUND"
  | "NOT_TASK_OWNER"
  | "TASK_NOT_COMPLETED"
  | "TASK_CANCELLED"
  | "TASK_NOT_FOR_TODAY"
  | "WORKDAY_ALREADY_ENDED"
  | "UNCOMPLETE_FAILED";

export type UncompleteMyTaskResult =
  | { success: true; task: DailyTaskRecord }
  | { success: false; code: UncompleteMyTaskErrorCode; message: string };

/**
 * Corrects an ordinary accidental completion while the workday remains
 * open (27A §32) — not historical editing after the day has closed. Same
 * ownership boundary as completion; no Admin/Manager override, not even
 * for the original assignor (27A §33).
 */
export async function uncompleteMyTaskCore(
  actor: DailyTaskActor,
  taskId: string,
  dependencies: UncompleteMyTaskDependencies,
  now: Date = new Date(),
): Promise<UncompleteMyTaskResult> {
  if (!actor.active) {
    return {
      success: false,
      code: "INACTIVE_USER",
      message: "Votre compte est désactivé.",
    };
  }

  if (!isEligibleDailyTaskRecipient(actor.role)) {
    return {
      success: false,
      code: "NOT_AUTHORIZED",
      message: "Vous n’avez pas de tâches à rouvrir.",
    };
  }

  const task = await dependencies.findTask(taskId);

  if (!task) {
    return {
      success: false,
      code: "TASK_NOT_FOUND",
      message: "Cette tâche est introuvable.",
    };
  }

  if (task.assignedToUserId !== actor.id) {
    return {
      success: false,
      code: "NOT_TASK_OWNER",
      message: "Cette tâche ne vous est pas assignée.",
    };
  }

  if (task.status === "CANCELLED") {
    return {
      success: false,
      code: "TASK_CANCELLED",
      message: "Cette tâche a été annulée.",
    };
  }

  if (task.status === "OPEN") {
    return {
      success: false,
      code: "TASK_NOT_COMPLETED",
      message: "Cette tâche n’est pas encore terminée.",
    };
  }

  const today = getCurrentWorkDate(now);

  if (!isSameBusinessDate(task.workDate, today)) {
    return {
      success: false,
      code: "TASK_NOT_FOR_TODAY",
      message: "Cette tâche n’est pas celle du jour.",
    };
  }

  const workday = await dependencies.findWorkdayOpenState(actor.id, today);

  if (workday && workday.endedAt !== null) {
    return {
      success: false,
      code: "WORKDAY_ALREADY_ENDED",
      message: "Votre journée est terminée : les tâches ne sont plus modifiables.",
    };
  }

  try {
    const result = await dependencies.uncompleteAtomically(taskId, actor.id);

    if (result.count === 0) {
      return {
        success: false,
        code: "TASK_NOT_COMPLETED",
        message: "Cette tâche n’est plus au statut terminé.",
      };
    }

    return {
      success: true,
      task: { ...task, status: "OPEN", completedAt: null },
    };
  } catch (error) {
    console.error("Unable to uncomplete daily task:", error);
    return {
      success: false,
      code: "UNCOMPLETE_FAILED",
      message: "Impossible de rouvrir cette tâche. Veuillez réessayer.",
    };
  }
}

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

export type CancelTaskInput = {
  taskId: string;
  cancellationReason: string;
};

export type CancelTaskDependencies = {
  findTask: (taskId: string) => Promise<DailyTaskRecord | null>;
  /** Consulted with the TASK's own assignedToUserId — never the cancelling actor's id — only when the task's workDate is today. */
  findWorkdayOpenState: (
    assignedToUserId: string,
    workDate: Date,
  ) => Promise<WorkdayOpenState | null>;
  cancelAtomically: (
    taskId: string,
    cancellationReason: string,
  ) => Promise<{ count: number }>;
};

export type CancelTaskErrorCode =
  | "INACTIVE_USER"
  | "NOT_AUTHORIZED"
  | "INVALID_CANCELLATION_REASON"
  | "TASK_NOT_FOUND"
  | "CANCELLATION_NOT_ALLOWED"
  | "TASK_ALREADY_COMPLETED"
  | "TASK_CANCELLED"
  | "PAST_DATE_NOT_ALLOWED"
  | "WORKDAY_ALREADY_ENDED"
  | "CANCEL_FAILED";

export type CancelTaskResult =
  | { success: true; task: DailyTaskRecord }
  | { success: false; code: CancelTaskErrorCode; message: string };

/**
 * Cancellation withdraws an assignment; it never rewrites who made it
 * (27E §1) — `assignedByUserId`/`assignedToUserId` are untouched by this
 * function, by construction (the guarded write only ever sets `status`
 * and `cancellationReason`). Authority is evaluated before task
 * state/date so an unauthorized actor learns nothing about the task's
 * current status.
 */
export async function cancelTaskCore(
  actor: DailyTaskActor,
  input: CancelTaskInput,
  dependencies: CancelTaskDependencies,
  now: Date = new Date(),
): Promise<CancelTaskResult> {
  if (!actor.active) {
    return {
      success: false,
      code: "INACTIVE_USER",
      message: "Votre compte est désactivé.",
    };
  }

  if (!canAttemptTaskAssignment(actor.role)) {
    return {
      success: false,
      code: "NOT_AUTHORIZED",
      message: "Vous n’avez pas le droit d’annuler une tâche.",
    };
  }

  if (input.cancellationReason.trim().length === 0) {
    return {
      success: false,
      code: "INVALID_CANCELLATION_REASON",
      message: "Indiquez la raison de l’annulation.",
    };
  }

  const task = await dependencies.findTask(input.taskId);

  if (!task) {
    return {
      success: false,
      code: "TASK_NOT_FOUND",
      message: "Cette tâche est introuvable.",
    };
  }

  if (
    !canCancelTask({
      actorRole: actor.role,
      actorUserId: actor.id,
      assignedByUserId: task.assignedByUserId,
    })
  ) {
    return {
      success: false,
      code: "CANCELLATION_NOT_ALLOWED",
      message: "Vous n’avez pas le droit d’annuler cette tâche.",
    };
  }

  if (task.status === "COMPLETED") {
    return {
      success: false,
      code: "TASK_ALREADY_COMPLETED",
      message: "Impossible d’annuler une tâche déjà terminée.",
    };
  }

  if (task.status === "CANCELLED") {
    return {
      success: false,
      code: "TASK_CANCELLED",
      message: "Cette tâche est déjà annulée.",
    };
  }

  const today = getCurrentWorkDate(now);

  if (task.workDate.getTime() < today.getTime()) {
    return {
      success: false,
      code: "PAST_DATE_NOT_ALLOWED",
      message: "Impossible d’annuler une tâche d’une date déjà passée.",
    };
  }

  if (isSameBusinessDate(task.workDate, today)) {
    const workday = await dependencies.findWorkdayOpenState(
      task.assignedToUserId,
      today,
    );
    if (workday && workday.endedAt !== null) {
      return {
        success: false,
        code: "WORKDAY_ALREADY_ENDED",
        message:
          "Impossible d’annuler cette tâche : la journée de cet employé est déjà terminée.",
      };
    }
  }

  try {
    const result = await dependencies.cancelAtomically(
      input.taskId,
      input.cancellationReason,
    );

    if (result.count === 0) {
      const raced = await dependencies.findTask(input.taskId);
      const code = resolveLostRaceCode(raced) ?? "TASK_CANCELLED";
      return {
        success: false,
        code,
        message:
          code === "TASK_ALREADY_COMPLETED"
            ? "Impossible d’annuler une tâche déjà terminée."
            : "Cette tâche est déjà annulée.",
      };
    }

    return {
      success: true,
      task: {
        ...task,
        status: "CANCELLED",
        cancellationReason: input.cancellationReason,
      },
    };
  } catch (error) {
    console.error("Unable to cancel daily task:", error);
    return {
      success: false,
      code: "CANCEL_FAILED",
      message: "Impossible d’annuler cette tâche. Veuillez réessayer.",
    };
  }
}
