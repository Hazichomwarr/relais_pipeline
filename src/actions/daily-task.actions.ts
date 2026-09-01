"use server";

import { authorizeAction } from "@/src/actions/authorize-action";
import {
  assignDailyTaskSchema,
  cancelDailyTaskSchema,
  completeDailyTaskSchema,
  uncompleteDailyTaskSchema,
} from "@/src/lib/validations/daily-task.schema";
import { resolveWorkDate } from "@/src/lib/workday-date";
import {
  requireDailyTaskRecipientAccess,
  requireTaskAssignmentAccess,
} from "@/src/services/authorization.service";
import {
  assignTask,
  cancelTask,
  completeMyTask,
  uncompleteMyTask,
} from "@/src/services/daily-task.service";
import type {
  AssignTaskResult,
  CancelTaskResult,
  CompleteMyTaskResult,
  UncompleteMyTaskResult,
} from "@/src/services/daily-task.service-core";

type FieldErrors = Record<string, string[] | undefined>;

/**
 * Ticket 27E §7/§49 — this IS an other-person action, so the recipient
 * (`assignedToUserId`) is explicit input, unlike completion/uncompletion
 * below. `assignTask` independently re-verifies authority against the
 * real, freshly-resolved subject — this action never trusts the coarse
 * route gate alone. The client may supply the recipient, the intended
 * business date, and the wording — never `assignedByUserId`,
 * `assignedAt`, `status`, or any subject role.
 */
export async function assignDailyTaskAction(
  values: unknown,
): Promise<AssignTaskResult | { success: false; message: string; fieldErrors?: FieldErrors }> {
  const authorization = await authorizeAction(() => requireTaskAssignmentAccess());

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = assignDailyTaskSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations de la tâche sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  return assignTask(authorization.user.id, {
    assignedToUserId: parsed.data.assignedToUserId,
    workDate: resolveWorkDate(parsed.data.workDate),
    content: parsed.data.content,
  });
}

/**
 * Ticket 27E §24/§41 — self actions accept only the task identifier;
 * actor identity always comes from `authorization.user.id`, never
 * client input. Ownership (`task.assignedToUserId === actor.id`) is
 * re-verified inside the service, not trusted from the caller.
 */
export async function completeMyDailyTaskAction(
  values: unknown,
): Promise<CompleteMyTaskResult | { success: false; message: string; fieldErrors?: FieldErrors }> {
  const authorization = await authorizeAction(() =>
    requireDailyTaskRecipientAccess(),
  );

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = completeDailyTaskSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Cette tâche est invalide.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  return completeMyTask(authorization.user.id, parsed.data.taskId);
}

export async function uncompleteMyDailyTaskAction(
  values: unknown,
): Promise<UncompleteMyTaskResult | { success: false; message: string; fieldErrors?: FieldErrors }> {
  const authorization = await authorizeAction(() =>
    requireDailyTaskRecipientAccess(),
  );

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = uncompleteDailyTaskSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Cette tâche est invalide.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  return uncompleteMyTask(authorization.user.id, parsed.data.taskId);
}

/**
 * Ticket 27E §37/§40 — an other-person (or, for a Manager, "my own
 * assignment only") action. `cancelTask` independently re-evaluates
 * `canCancelTask` against the real, freshly-resolved task — this action
 * never trusts the coarse route gate alone. The client may supply the
 * task id and the reason — never the cancelling actor's identity or the
 * resulting status.
 */
export async function cancelDailyTaskAction(
  values: unknown,
): Promise<CancelTaskResult | { success: false; message: string; fieldErrors?: FieldErrors }> {
  const authorization = await authorizeAction(() => requireTaskAssignmentAccess());

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = cancelDailyTaskSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations de l’annulation sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  return cancelTask(authorization.user.id, {
    taskId: parsed.data.taskId,
    cancellationReason: parsed.data.cancellationReason,
  });
}
