import "server-only";

import type { Prisma, UserRole } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";
import {
  composeDailyWorkManagementOverview,
  resolveMissingUserIds,
  type DailyWorkAgent,
  type DailyWorkManagementActor,
} from "@/src/services/daily-work-management.service-core";

export type { DailyWorkAgent, DailyWorkManagementActor, DailyWorkManagementTask, RosterUser } from
  "@/src/services/daily-work-management.service-core";

export type DailyWorkManagementOverview = {
  workDate: Date;
  agents: DailyWorkAgent[];
};

/** MANAGER, COMMERCIAL, ASSISTANT — the domain's Workday-eligible roster (27A/27C). ADMIN is never part of it (27A §4/§11). */
const DAILY_WORK_ROSTER_ROLES: UserRole[] = ["MANAGER", "COMMERCIAL", "ASSISTANT"];

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
  active: true,
} satisfies Prisma.UserSelect;

const workdaySelect = {
  id: true,
  employeeUserId: true,
  workDate: true,
  expectedStartTime: true,
  expectedEndTime: true,
  startedAt: true,
  confirmedAt: true,
  confirmedByUserId: true,
  endedAt: true,
} satisfies Prisma.WorkdaySelect;

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
 * Ticket 27G §48-50 — four bounded queries at most, never one per
 * employee: the active roster, every Workday for today, every DailyTask
 * for today (both queried directly at the workDate= boundary), then —
 * only if resolveMissingUserIds found any — one more bounded query for
 * exactly the missing User rows. All actual composition/authority logic
 * lives in daily-work-management.service-core.ts; this file only fetches.
 */
export async function getDailyWorkManagementOverview(
  actor: DailyWorkManagementActor,
  workDate: Date,
): Promise<DailyWorkManagementOverview> {
  const roster = await prisma.user.findMany({
    where: { active: true, role: { in: DAILY_WORK_ROSTER_ROLES } },
    select: userSelect,
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const [workdays, tasks] = await Promise.all([
    prisma.workday.findMany({ where: { workDate }, select: workdaySelect }),
    prisma.dailyTask.findMany({
      where: { workDate },
      select: dailyTaskSelect,
      orderBy: [{ assignedAt: "asc" }, { id: "asc" }],
    }),
  ]);

  const missingUserIds = resolveMissingUserIds(roster, workdays, tasks);

  const extraUsers =
    missingUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: missingUserIds } },
          select: userSelect,
        })
      : [];

  const agents = composeDailyWorkManagementOverview(actor, roster, workdays, tasks, extraUsers);

  return { workDate, agents };
}
