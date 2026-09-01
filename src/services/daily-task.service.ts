import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";
import {
  assignTaskCore,
  cancelTaskCore,
  completeMyTaskCore,
  uncompleteMyTaskCore,
  type AssignTaskInput,
  type AssignTaskResult,
  type CancelTaskInput,
  type CancelTaskResult,
  type CompleteMyTaskResult,
  type DailyTaskActor,
  type UncompleteMyTaskResult,
} from "@/src/services/daily-task.service-core";

const dailyTaskSelect = {
  id: true,
  workDate: true,
  assignedToUserId: true,
  assignedByUserId: true,
  content: true,
  assignedAt: true,
  status: true,
  completedAt: true,
  cancellationReason: true,
} satisfies Prisma.DailyTaskSelect;

/**
 * Session/JWT carries no `active` flag and role can drift from the
 * database between login and now — every DailyTask mutation re-resolves
 * a fresh DailyTaskActor from the database rather than trusting the
 * session alone, exactly like Workday's resolveWorkdayActor (27C).
 */
async function resolveDailyTaskActor(
  userId: string,
): Promise<DailyTaskActor | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, active: true },
  });
}

const dependencies = {
  findSubject: (userId: string) =>
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, active: true },
    }),
  findWorkdayOpenState: (employeeUserId: string, workDate: Date) =>
    prisma.workday.findUnique({
      where: { employeeUserId_workDate: { employeeUserId, workDate } },
      select: { endedAt: true },
    }),
  create: (fields: {
    workDate: Date;
    assignedToUserId: string;
    assignedByUserId: string;
    content: string;
    assignedAt: Date;
  }) =>
    prisma.dailyTask.create({
      data: fields,
      select: dailyTaskSelect,
    }),
  findTask: (taskId: string) =>
    prisma.dailyTask.findUnique({
      where: { id: taskId },
      select: dailyTaskSelect,
    }),
  completeAtomically: (
    taskId: string,
    assignedToUserId: string,
    completedAt: Date,
  ) =>
    prisma.dailyTask.updateMany({
      where: { id: taskId, assignedToUserId, status: "OPEN" },
      data: { status: "COMPLETED", completedAt },
    }),
  uncompleteAtomically: (taskId: string, assignedToUserId: string) =>
    prisma.dailyTask.updateMany({
      where: { id: taskId, assignedToUserId, status: "COMPLETED" },
      data: { status: "OPEN", completedAt: null },
    }),
  cancelAtomically: (taskId: string, cancellationReason: string) =>
    prisma.dailyTask.updateMany({
      where: { id: taskId, status: "OPEN" },
      data: { status: "CANCELLED", cancellationReason },
    }),
};

export async function assignTask(
  actorUserId: string,
  input: AssignTaskInput,
): Promise<AssignTaskResult> {
  const actor = await resolveDailyTaskActor(actorUserId);

  if (!actor) {
    return {
      success: false,
      code: "INACTIVE_USER",
      message: "Votre compte est désactivé.",
    };
  }

  return assignTaskCore(actor, input, {
    findSubject: dependencies.findSubject,
    findWorkdayOpenState: dependencies.findWorkdayOpenState,
    create: dependencies.create,
  });
}

export async function completeMyTask(
  actorUserId: string,
  taskId: string,
): Promise<CompleteMyTaskResult> {
  const actor = await resolveDailyTaskActor(actorUserId);

  if (!actor) {
    return {
      success: false,
      code: "INACTIVE_USER",
      message: "Votre compte est désactivé.",
    };
  }

  return completeMyTaskCore(actor, taskId, {
    findTask: dependencies.findTask,
    findWorkdayOpenState: dependencies.findWorkdayOpenState,
    completeAtomically: dependencies.completeAtomically,
  });
}

export async function uncompleteMyTask(
  actorUserId: string,
  taskId: string,
): Promise<UncompleteMyTaskResult> {
  const actor = await resolveDailyTaskActor(actorUserId);

  if (!actor) {
    return {
      success: false,
      code: "INACTIVE_USER",
      message: "Votre compte est désactivé.",
    };
  }

  return uncompleteMyTaskCore(actor, taskId, {
    findTask: dependencies.findTask,
    findWorkdayOpenState: dependencies.findWorkdayOpenState,
    uncompleteAtomically: dependencies.uncompleteAtomically,
  });
}

export async function cancelTask(
  actorUserId: string,
  input: CancelTaskInput,
): Promise<CancelTaskResult> {
  const actor = await resolveDailyTaskActor(actorUserId);

  if (!actor) {
    return {
      success: false,
      code: "INACTIVE_USER",
      message: "Votre compte est désactivé.",
    };
  }

  return cancelTaskCore(actor, input, {
    findTask: dependencies.findTask,
    findWorkdayOpenState: dependencies.findWorkdayOpenState,
    cancelAtomically: dependencies.cancelAtomically,
  });
}

/**
 * Ticket 27E §52 — the minimum read primitives lifecycle and the
 * immediately upcoming employee UI (27F) need. Not a management history
 * system (27G) and not date-range analytics.
 */
export async function getMyDailyTasksForDate(actorUserId: string, workDate: Date) {
  return prisma.dailyTask.findMany({
    where: { assignedToUserId: actorUserId, workDate },
    orderBy: [{ assignedAt: "asc" }, { id: "asc" }],
    select: dailyTaskSelect,
  });
}

export async function getDailyTaskById(taskId: string) {
  return prisma.dailyTask.findUnique({
    where: { id: taskId },
    select: dailyTaskSelect,
  });
}
