import type { DailyTaskStatus } from "@prisma/client";

import type { DailyTaskRecord } from "@/src/services/daily-task.service-core";

/**
 * Ticket 27F — pure presentation logic for "Ma journée." No domain rules
 * live here: this file only derives *how to display* facts the 27C/27E
 * cores already computed, never re-decides eligibility, authority, or
 * lifecycle transitions.
 */

export type WorkdayDisplayState =
  | "NOT_STARTED"
  | "STARTED_UNCONFIRMED"
  | "STARTED_CONFIRMED"
  | "ENDED_UNCONFIRMED"
  | "ENDED_CONFIRMED";

export type WorkdayLike = {
  confirmedAt: Date | null;
  endedAt: Date | null;
};

/**
 * Mirrors 27A §12.1's derived-lifecycle table exactly — Workday carries
 * no persisted status, so this is the one place the five display states
 * are computed from the timestamp tuple, for rendering only.
 */
export function resolveWorkdayDisplayState(
  workday: WorkdayLike | null,
): WorkdayDisplayState {
  if (!workday) {
    return "NOT_STARTED";
  }

  if (workday.endedAt) {
    return workday.confirmedAt ? "ENDED_CONFIRMED" : "ENDED_UNCONFIRMED";
  }

  return workday.confirmedAt ? "STARTED_CONFIRMED" : "STARTED_UNCONFIRMED";
}

/** 480 -> "08:00". Minutes-since-business-midnight is the stored snapshot shape (27B); this is purely a display transform. */
export function formatMinutesAsTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const remainder = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${remainder}`;
}

const DAILY_TASK_STATUS_ORDER: Record<DailyTaskStatus, number> = {
  OPEN: 0,
  COMPLETED: 1,
  CANCELLED: 2,
};

/**
 * OPEN, then COMPLETED, then CANCELLED (27A §46/27F §46) — within a
 * group, stable ascending assignedAt order, with an id tie-break so
 * rendering never depends on incidental fetch order or reshuffles
 * between renders.
 */
export function sortDailyTasksForDisplay<
  T extends { status: DailyTaskStatus; assignedAt: Date; id: string },
>(tasks: T[]): T[] {
  return [...tasks].sort((left, right) => {
    const statusDiff =
      DAILY_TASK_STATUS_ORDER[left.status] - DAILY_TASK_STATUS_ORDER[right.status];
    if (statusDiff !== 0) {
      return statusDiff;
    }

    const assignedDiff = left.assignedAt.getTime() - right.assignedAt.getTime();
    if (assignedDiff !== 0) {
      return assignedDiff;
    }

    if (left.id === right.id) {
      return 0;
    }
    return left.id < right.id ? -1 : 1;
  });
}

export type DailyTaskProgress = {
  completed: number;
  /** Excludes CANCELLED — cancellation is not unfinished employee work (27A §47). */
  total: number;
};

export function computeDailyTaskProgress(
  tasks: Array<{ status: DailyTaskStatus }>,
): DailyTaskProgress {
  const countable = tasks.filter((task) => task.status !== "CANCELLED");
  const completed = countable.filter((task) => task.status === "COMPLETED").length;
  return { completed, total: countable.length };
}

/**
 * "Lundi 1 septembre 2026" — the page header's date (27F §5). Formatted
 * against the "UTC" Intl timeZone deliberately, same reasoning as
 * daily-report-date.ts's formatLongDailyReportDate: RELAIS's business
 * offset is 0, so UTC wall time already is business-local wall time.
 */
export function formatLongWorkDateWithWeekday(date: Date): string {
  const formatted = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function groupDailyTasksForDisplay(tasks: DailyTaskRecord[]) {
  const sorted = sortDailyTasksForDisplay(tasks);
  return {
    active: sorted.filter((task) => task.status !== "CANCELLED"),
    cancelled: sorted.filter((task) => task.status === "CANCELLED"),
    progress: computeDailyTaskProgress(sorted),
  };
}
