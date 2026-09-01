import { Clock } from "lucide-react";

import AssignDailyTaskDialog from "@/component/daily-work/management/AssignDailyTaskDialog";
import ConfirmWorkdayButton from "@/component/daily-work/management/ConfirmWorkdayButton";
import ManagementTaskItem from "@/component/daily-work/management/ManagementTaskItem";
import { getUserRoleLabel } from "@/src/lib/constants/user-options";
import { formatDailyReportTime } from "@/src/lib/daily-report-date";
import {
  formatMinutesAsTime,
  groupDailyTasksForDisplay,
  resolveWorkdayDisplayState,
} from "@/src/lib/daily-work-presentation";
import { getWorkdayStateDotClassName } from "@/src/lib/daily-work-management-presentation";
import type { DailyWorkAgent } from "@/src/services/daily-work-management.service";
import {
  DEFAULT_WORKDAY_EXPECTED_END_MINUTES,
  DEFAULT_WORKDAY_EXPECTED_START_MINUTES,
} from "@/src/services/workday.service-core";

type DailyWorkAgentDetailProps = {
  agent: DailyWorkAgent;
  workDate: Date;
};

/**
 * Ticket 27G §19-29 — visually related to 27F's Workday hero without
 * duplicating it at full scale (§20): a compact info block, never a
 * second giant card. Shows only what's operationally true — no email,
 * no user id, no role enum, no createdAt/updatedAt (§19). The confirm
 * CTA renders exactly when the read composition's canConfirmStart is
 * true — which already reuses 27C's real canConfirmWorkdayStart, and
 * remains available for an eligible ended/unconfirmed Workday (§25),
 * since "today" doesn't change just because the employee already ended.
 */
export default function DailyWorkAgentDetail({ agent, workDate }: DailyWorkAgentDetailProps) {
  const { workday, user } = agent;
  const state = resolveWorkdayDisplayState(workday);
  const agentName = `${user.firstName} ${user.lastName}`;

  const expectedStart = formatMinutesAsTime(
    workday?.expectedStartTime ?? DEFAULT_WORKDAY_EXPECTED_START_MINUTES,
  );
  const expectedEnd = formatMinutesAsTime(
    workday?.expectedEndTime ?? DEFAULT_WORKDAY_EXPECTED_END_MINUTES,
  );

  const { active, cancelled, progress } = groupDailyTasksForDisplay(agent.tasks);

  return (
    <div id="agent-detail" className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
      <div>
        <h2 className="text-xl font-bold text-[#0f2557]">{agentName}</h2>
        <p className="mt-1 text-sm text-slate-500">{getUserRoleLabel(user.role)}</p>
      </div>

      <div className="mt-6 rounded-2xl bg-slate-50 p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span
            className={`h-2.5 w-2.5 rounded-full ${getWorkdayStateDotClassName(state)}`}
            aria-hidden="true"
          />
          {state === "NOT_STARTED" ? "Pas encore commencée" : "Journée"}
        </p>

        {workday ? (
          <div className="mt-3 space-y-2 text-sm">
            {workday.endedAt ? (
              <p className="font-semibold text-slate-700">
                {formatDailyReportTime(workday.startedAt)} — {formatDailyReportTime(workday.endedAt)}
              </p>
            ) : (
              <p className="text-slate-600">
                Début déclaré · <span className="font-semibold text-slate-700">{formatDailyReportTime(workday.startedAt)}</span>
              </p>
            )}

            <p className="text-slate-500">
              {workday.confirmedAt
                ? `Présence confirmée à ${formatDailyReportTime(workday.confirmedAt)}`
                : "Confirmation en attente"}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Aucune déclaration de début pour aujourd’hui.</p>
        )}

        <p className="mt-4 flex items-center gap-2 border-t border-slate-200 pt-4 text-xs text-slate-400">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          Horaire prévu · {expectedStart} — {expectedEnd}
        </p>

        {agent.canConfirmStart && workday && (
          <div className="mt-4">
            <ConfirmWorkdayButton employeeUserId={user.id} workDate={workDate} />
          </div>
        )}
      </div>

      {user.role === "ASSISTANT" ? (
        <p className="mt-6 text-sm text-slate-400">
          Les assistants ne reçoivent pas de tâches du jour dans ce flux.
        </p>
      ) : (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-[0.1em] text-slate-500">
              Tâches du jour
            </h3>
            {progress.total > 0 && (
              <span className="text-xs font-medium text-slate-400">
                {progress.completed}/{progress.total} terminées
              </span>
            )}
          </div>

          {active.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
              Aucune tâche assignée pour aujourd’hui.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
              {active.map((task) => (
                <ManagementTaskItem key={task.id} task={task} />
              ))}
            </div>
          )}

          {cancelled.length > 0 && (
            <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/60">
              {cancelled.map((task) => (
                <ManagementTaskItem key={task.id} task={task} />
              ))}
            </div>
          )}

          {agent.canAssignTask && (
            <div className="mt-4">
              <AssignDailyTaskDialog
                assignedToUserId={user.id}
                agentName={agentName}
                workDate={workDate}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
