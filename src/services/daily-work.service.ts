import "server-only";

import { getMyDailyTasksForDate } from "@/src/services/daily-task.service";
import { getMyWorkdayForDate } from "@/src/services/workday.service";

/**
 * Ticket 27F §38 — the one page-level read/composition boundary for
 * "Ma journée," so app/ma-journee/page.tsx queries the two independent
 * Workday/DailyTask domains exactly once each, in parallel, rather than
 * re-querying piecemeal. This is a read composition only — it owns no
 * mutation policy (that stays in workday.service.ts / daily-task.service.ts)
 * and derives no display state (that's src/lib/daily-work-presentation.ts).
 */
export async function getMyDailyWork(actorUserId: string, workDate: Date) {
  const [workday, tasks] = await Promise.all([
    getMyWorkdayForDate(actorUserId, workDate),
    getMyDailyTasksForDate(actorUserId, workDate),
  ]);

  return { workDate, workday, tasks };
}
