import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";
import {
  confirmWorkdayStartForCore,
  endMyWorkdayCore,
  startMyWorkdayCore,
  type ConfirmWorkdayStartInput,
  type ConfirmWorkdayStartResult,
  type EndWorkdayResult,
  type StartWorkdayResult,
  type WorkdayActor,
} from "@/src/services/workday.service-core";

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

/**
 * Session/JWT carries no `active` flag (26A finding, unchanged) and role
 * can drift from the database between login and now — every Workday
 * mutation re-resolves a fresh WorkdayActor from the database rather than
 * trusting the session alone (27C §8/§17/§25). Returns null only if the
 * User row itself is gone, which cannot happen today (no User-deletion
 * path exists, 26A §25) but is handled defensively regardless.
 */
async function resolveWorkdayActor(
  userId: string,
): Promise<WorkdayActor | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, active: true },
  });
}

const dependencies = {
  findExisting: (employeeUserId: string, workDate: Date) =>
    prisma.workday.findUnique({
      where: { employeeUserId_workDate: { employeeUserId, workDate } },
      select: workdaySelect,
    }),
  create: async (fields: {
    employeeUserId: string;
    workDate: Date;
    expectedStartTime: number;
    expectedEndTime: number;
    startedAt: Date;
  }) => {
    try {
      const workday = await prisma.workday.create({
        data: fields,
        select: workdaySelect,
      });
      return { outcome: "CREATED" as const, workday };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        // Lost a genuine concurrent double-start race against the
        // @@unique([employeeUserId, workDate]) constraint — 27B's
        // database invariant, not merely an application convention.
        return { outcome: "DUPLICATE" as const };
      }
      throw error;
    }
  },
  findCurrent: (employeeUserId: string, workDate: Date) =>
    prisma.workday.findUnique({
      where: { employeeUserId_workDate: { employeeUserId, workDate } },
      select: workdaySelect,
    }),
  endAtomically: (workdayId: string, employeeUserId: string, endedAt: Date) =>
    prisma.workday.updateMany({
      where: { id: workdayId, employeeUserId, endedAt: null },
      data: { endedAt },
    }),
  findSubject: (employeeUserId: string) =>
    prisma.user.findUnique({
      where: { id: employeeUserId },
      select: { id: true, role: true, active: true },
    }),
  findWorkday: (employeeUserId: string, workDate: Date) =>
    prisma.workday.findUnique({
      where: { employeeUserId_workDate: { employeeUserId, workDate } },
      select: workdaySelect,
    }),
  confirmAtomically: (
    workdayId: string,
    confirmedByUserId: string,
    confirmedAt: Date,
  ) =>
    prisma.workday.updateMany({
      where: { id: workdayId, confirmedAt: null },
      data: { confirmedAt, confirmedByUserId },
    }),
};

export async function startMyWorkday(
  actorUserId: string,
): Promise<StartWorkdayResult> {
  const actor = await resolveWorkdayActor(actorUserId);

  if (!actor) {
    return {
      success: false,
      code: "INACTIVE_USER",
      message: "Votre compte est désactivé.",
    };
  }

  return startMyWorkdayCore(actor, {
    findExisting: dependencies.findExisting,
    create: dependencies.create,
  });
}

export async function endMyWorkday(
  actorUserId: string,
): Promise<EndWorkdayResult> {
  const actor = await resolveWorkdayActor(actorUserId);

  if (!actor) {
    return {
      success: false,
      code: "INACTIVE_USER",
      message: "Votre compte est désactivé.",
    };
  }

  return endMyWorkdayCore(actor, {
    findCurrent: dependencies.findCurrent,
    endAtomically: dependencies.endAtomically,
  });
}

export async function confirmWorkdayStartFor(
  actorUserId: string,
  input: ConfirmWorkdayStartInput,
): Promise<ConfirmWorkdayStartResult> {
  const actor = await resolveWorkdayActor(actorUserId);

  if (!actor) {
    return {
      success: false,
      code: "INACTIVE_USER",
      message: "Votre compte est désactivé.",
    };
  }

  return confirmWorkdayStartForCore(actor, input, {
    findSubject: dependencies.findSubject,
    findWorkday: dependencies.findWorkday,
    confirmAtomically: dependencies.confirmAtomically,
  });
}

/**
 * Ticket 27C §43 — the minimum read primitives the lifecycle mutations'
 * future callers need. Deliberately not a history/date-range/roster
 * query — those belong to 27F/27G. `null` means exactly "no start
 * declaration exists for this employee/date," never inferred absence
 * (27A §55, 27C §44) — weekends, leave, and holidays are not modeled and
 * this function does not attempt to distinguish them.
 */
export async function getMyWorkdayForDate(actorUserId: string, workDate: Date) {
  return prisma.workday.findUnique({
    where: { employeeUserId_workDate: { employeeUserId: actorUserId, workDate } },
    select: workdaySelect,
  });
}

/** Same query as getMyWorkdayForDate, named for the "confirming someone else's day" call-site intent (27A §60/§77's management view will use this shape). */
export async function getWorkdayForEmployeeDate(
  employeeUserId: string,
  workDate: Date,
) {
  return prisma.workday.findUnique({
    where: { employeeUserId_workDate: { employeeUserId, workDate } },
    select: workdaySelect,
  });
}
