import Link from "next/link";

import { getUserRoleLabel } from "@/src/lib/constants/user-options";
import { formatDailyReportTime } from "@/src/lib/daily-report-date";
import {
  computeDailyTaskProgress,
  resolveWorkdayDisplayState,
} from "@/src/lib/daily-work-presentation";
import {
  getWorkdayStateDotClassName,
  getWorkdayStateLabel,
} from "@/src/lib/daily-work-management-presentation";
import { getInitialsFromName } from "@/src/lib/initials";
import type { DailyWorkAgent } from "@/src/services/daily-work-management.service";

type DailyWorkAgentRowProps = {
  agent: DailyWorkAgent;
  selected: boolean;
};

/**
 * Ticket 27G §13/§59 — enough to scan without opening the detail: name,
 * role, state (dot + text, never color alone), start time when
 * applicable, and compact task progress for MANAGER/COMMERCIAL only — no
 * fake task count for ASSISTANT (§13), who has no DailyTask workflow at
 * all. Selection is a plain link to ?agent=<id> (27G §17) — presentation
 * only; no mutation ever trusts this parameter.
 */
export default function DailyWorkAgentRow({ agent, selected }: DailyWorkAgentRowProps) {
  const state = resolveWorkdayDisplayState(agent.workday);
  const progress =
    agent.user.role === "ASSISTANT" ? null : computeDailyTaskProgress(agent.tasks);

  return (
    <Link
      href={`?agent=${agent.user.id}#agent-detail`}
      aria-current={selected ? "true" : undefined}
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition ${
        selected ? "bg-blue-50" : "hover:bg-slate-50"
      }`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0f2557] text-sm font-bold text-white">
        {getInitialsFromName(`${agent.user.firstName} ${agent.user.lastName}`)}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-semibold text-slate-800">
            {agent.user.firstName} {agent.user.lastName}
          </span>
          {agent.workday && state !== "NOT_STARTED" && (
            <span className="shrink-0 text-xs text-slate-400">
              {formatDailyReportTime(agent.workday.startedAt)}
            </span>
          )}
        </span>

        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${getWorkdayStateDotClassName(state)}`}
            aria-hidden="true"
          />
          {getUserRoleLabel(agent.user.role)} · {getWorkdayStateLabel(state)}
        </span>

        {progress !== null && progress.total > 0 && (
          <span className="mt-0.5 block text-xs text-slate-400">
            {progress.completed}/{progress.total} tâches
          </span>
        )}
      </span>
    </Link>
  );
}
