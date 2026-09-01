import { redirect } from "next/navigation";

import DailyWorkAgentDetail from "@/component/daily-work/management/DailyWorkAgentDetail";
import DailyWorkAgentList from "@/component/daily-work/management/DailyWorkAgentList";
import DailyWorkSummary from "@/component/daily-work/management/DailyWorkSummary";
import {
  resolveDefaultSelectedAgentId,
  sortAgentsForManagement,
} from "@/src/lib/daily-work-management-presentation";
import { formatLongWorkDateWithWeekday } from "@/src/lib/daily-work-presentation";
import { getCurrentWorkDate } from "@/src/lib/workday-date";
import {
  AuthorizationError,
  requireDailyWorkManagementAccess,
} from "@/src/services/authorization.service";
import { getDailyWorkManagementOverview } from "@/src/services/daily-work-management.service";

type JourneesAgentsSearchParams = Promise<{ agent?: string }>;

/**
 * Ticket 27G — the management counterpart to /ma-journee. Today only
 * (§6): no date picker, no history — the route always means the current
 * RELAIS business date. Selection is plain URL state (?agent=<id>, §17)
 * — presentation only; every mutation triggered from the detail panel
 * independently re-resolves and re-authorizes its real subject/task
 * server-side (27C/27E, unchanged), never trusting this parameter.
 */
export default async function JourneesAgentsPage({
  searchParams,
}: {
  searchParams: JourneesAgentsSearchParams;
}) {
  let actor;

  try {
    actor = await requireDailyWorkManagementAccess();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.code === "UNAUTHENTICATED" ? "/login" : "/admin");
    }
    throw error;
  }

  const params = await searchParams;
  const workDate = getCurrentWorkDate();
  const { agents } = await getDailyWorkManagementOverview(
    { id: actor.id, role: actor.role },
    workDate,
  );

  const sorted = sortAgentsForManagement(agents);
  const requestedAgentId = params.agent;
  const selectedAgentId =
    requestedAgentId && sorted.some((agent) => agent.user.id === requestedAgentId)
      ? requestedAgentId
      : resolveDefaultSelectedAgentId(sorted);
  const selectedAgent = sorted.find((agent) => agent.user.id === selectedAgentId) ?? null;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-[#0f2557] md:text-4xl">
          Journées des agents
        </h1>
        <p className="mt-2 text-base text-slate-500">
          Suivez l’organisation de la journée et les tâches assignées.
        </p>
        <p className="mt-1 text-sm text-slate-400">{formatLongWorkDateWithWeekday(workDate)}</p>
      </header>

      <DailyWorkSummary agents={agents} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <DailyWorkAgentList agents={agents} selectedAgentId={selectedAgentId} />

        {selectedAgent ? (
          <DailyWorkAgentDetail agent={selectedAgent} workDate={workDate} />
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
            Sélectionnez un agent pour voir le détail de sa journée.
          </div>
        )}
      </div>
    </div>
  );
}
