import type { UserRole } from "@prisma/client";

import {
  canAssignTask,
  canCancelTask,
  type DailyTaskRecord,
} from "@/src/services/daily-task.service-core";
import { canConfirmWorkdayStart, type WorkdayRecord } from "@/src/services/workday.service-core";

/**
 * Ticket 27G — the pure domain-composition core for "Journées des
 * agents." No Prisma import (matches every other *.service-core.ts in
 * this codebase) — the wiring layer (daily-work-management.service.ts)
 * owns fetching; this file only assembles already-fetched rows into the
 * per-agent presentation model, reusing 27C/27E's real authority helpers
 * (canConfirmWorkdayStart, canAssignTask, canCancelTask) for every
 * presentation-hint boolean it derives.
 */

export type DailyWorkManagementActor = {
  id: string;
  role: UserRole;
};

export type RosterUser = {
  id: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  active: boolean;
};

export type DailyWorkManagementTask = DailyTaskRecord & {
  /** Whether the CURRENT actor may cancel this specific OPEN task right now. */
  canCancel: boolean;
  assignedByName: string;
};

export type DailyWorkAgent = {
  user: RosterUser;
  workday: WorkdayRecord | null;
  tasks: DailyWorkManagementTask[];
  canConfirmStart: boolean;
  canAssignTask: boolean;
};

/**
 * Ticket 27G §8/§48-50 — the wiring layer calls this FIRST, after
 * fetching only the active roster + today's Workdays/DailyTasks, to
 * learn exactly which additional User rows it must fetch (a same-day
 * deactivation/role-change, or a task assignor who was never part of the
 * roster — e.g. an ADMIN). No employee id already covered by the roster
 * is ever re-requested.
 */
export function resolveMissingUserIds(
  roster: RosterUser[],
  workdays: Pick<WorkdayRecord, "employeeUserId">[],
  tasks: Pick<DailyTaskRecord, "assignedToUserId" | "assignedByUserId">[],
): string[] {
  const knownIds = new Set(roster.map((user) => user.id));
  const missing = new Set<string>();

  for (const workday of workdays) {
    if (!knownIds.has(workday.employeeUserId)) {
      missing.add(workday.employeeUserId);
    }
  }
  for (const task of tasks) {
    if (!knownIds.has(task.assignedToUserId)) {
      missing.add(task.assignedToUserId);
    }
    if (!knownIds.has(task.assignedByUserId)) {
      missing.add(task.assignedByUserId);
    }
  }

  return Array.from(missing);
}

/**
 * Ticket 27G §8 — a truthful same-day Workday/DailyTask is never dropped
 * merely because its employee no longer matches today's active-roster
 * query: `extraUsers` (already fetched by the wiring layer via
 * resolveMissingUserIds) is unioned with `roster` before any agent row
 * is built, so a same-day deactivation, a role change, or a
 * non-roster assignor (an ADMIN) is still represented truthfully.
 * Current roster eligibility and already-created historical facts are
 * different things (27A §8) — this function never conflates them.
 */
export function composeDailyWorkManagementOverview(
  actor: DailyWorkManagementActor,
  roster: RosterUser[],
  workdays: WorkdayRecord[],
  tasks: DailyTaskRecord[],
  extraUsers: RosterUser[] = [],
): DailyWorkAgent[] {
  const userById = new Map<string, RosterUser>(
    [...roster, ...extraUsers].map((user) => [user.id, user]),
  );

  function displayName(userId: string): string {
    const user = userById.get(userId);
    return user ? `${user.firstName} ${user.lastName}` : "Utilisateur";
  }

  const agentIds = new Set<string>(roster.map((user) => user.id));
  for (const workday of workdays) {
    agentIds.add(workday.employeeUserId);
  }
  for (const task of tasks) {
    agentIds.add(task.assignedToUserId);
  }

  const workdayByEmployee = new Map(workdays.map((workday) => [workday.employeeUserId, workday]));
  const tasksByEmployee = new Map<string, DailyTaskRecord[]>();
  for (const task of tasks) {
    const existing = tasksByEmployee.get(task.assignedToUserId);
    if (existing) {
      existing.push(task);
    } else {
      tasksByEmployee.set(task.assignedToUserId, [task]);
    }
  }

  return Array.from(agentIds)
    .map((id) => userById.get(id))
    .filter((user): user is RosterUser => Boolean(user))
    .map((user) => {
      const workday = workdayByEmployee.get(user.id) ?? null;
      const employeeTasks = tasksByEmployee.get(user.id) ?? [];
      const isSelf = actor.id === user.id;

      const canConfirmStart =
        workday !== null &&
        workday.confirmedAt === null &&
        canConfirmWorkdayStart(actor.role, user.role, isSelf);

      const canAssignForAgent =
        canAssignTask(actor.role, user.role, isSelf) &&
        (workday === null || workday.endedAt === null);

      const composedTasks: DailyWorkManagementTask[] = employeeTasks.map((task) => ({
        ...task,
        canCancel:
          task.status === "OPEN" &&
          canCancelTask({
            actorRole: actor.role,
            actorUserId: actor.id,
            assignedByUserId: task.assignedByUserId,
          }),
        assignedByName: displayName(task.assignedByUserId),
      }));

      return {
        user,
        workday,
        tasks: composedTasks,
        canConfirmStart,
        canAssignTask: canAssignForAgent,
      };
    });
}
