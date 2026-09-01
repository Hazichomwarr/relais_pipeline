import { redirect } from "next/navigation";

import AssistantDailyGuidance from "@/component/daily-work/AssistantDailyGuidance";
import DailyTaskList from "@/component/daily-work/DailyTaskList";
import WorkdayHeroCard from "@/component/daily-work/WorkdayHeroCard";
import {
  formatLongWorkDateWithWeekday,
  resolveWorkdayDisplayState,
} from "@/src/lib/daily-work-presentation";
import { getCurrentWorkDate } from "@/src/lib/workday-date";
import {
  AuthorizationError,
  requireWorkdayEligibility,
} from "@/src/services/authorization.service";
import { getMyDailyWork } from "@/src/services/daily-work.service";

/**
 * Ticket 27F — the employee-facing "Ma journée" workspace. Identity is
 * always the current authenticated employee (§39) — this route accepts
 * no ?userId=/?employee= parameter of any kind, and never can, since
 * getMyDailyWork is called with the server-resolved actor id only. The
 * displayed date and every query use the RELAIS business date (§40),
 * never browser-local time.
 */
export default async function MaJourneePage() {
  let user;

  try {
    user = await requireWorkdayEligibility();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.code === "UNAUTHENTICATED" ? "/login" : "/admin");
    }
    throw error;
  }

  const workDate = getCurrentWorkDate();
  const { workday, tasks } = await getMyDailyWork(user.id, workDate);

  const workdayState = resolveWorkdayDisplayState(workday);
  const openTaskCount = tasks.filter((task) => task.status === "OPEN").length;

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[#0f2557] md:text-4xl">
          Ma journée
        </h1>
        <p className="mt-2 text-base text-slate-500">
          {formatLongWorkDateWithWeekday(workDate)}
        </p>
      </header>

      <div className="mb-8">
        <WorkdayHeroCard workday={workday} openTaskCount={openTaskCount} />
      </div>

      {user.role === "ASSISTANT" ? (
        <AssistantDailyGuidance />
      ) : (
        <DailyTaskList tasks={tasks} workdayState={workdayState} />
      )}
    </div>
  );
}
