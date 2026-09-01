import { resolveWorkdayDisplayState } from "@/src/lib/daily-work-presentation";
import type { DailyWorkAgent } from "@/src/services/daily-work-management.service";

type DailyWorkSummaryProps = {
  agents: DailyWorkAgent[];
};

/**
 * Ticket 27G §11 — a compact orientation strip, deliberately not four
 * equal KPI cards. Counts are supporting context; the agent roster below
 * remains the actual product.
 */
export default function DailyWorkSummary({ agents }: DailyWorkSummaryProps) {
  let started = 0;
  let confirmed = 0;
  let ended = 0;

  for (const agent of agents) {
    const state = resolveWorkdayDisplayState(agent.workday);
    if (state !== "NOT_STARTED") {
      started += 1;
    }
    if (state === "STARTED_CONFIRMED" || state === "ENDED_CONFIRMED") {
      confirmed += 1;
    }
    if (state === "ENDED_UNCONFIRMED" || state === "ENDED_CONFIRMED") {
      ended += 1;
    }
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
      <span className="font-semibold text-slate-700">
        {started} commencée{started > 1 ? "s" : ""}
      </span>
      <span aria-hidden="true">·</span>
      <span>
        {confirmed} confirmée{confirmed > 1 ? "s" : ""}
      </span>
      <span aria-hidden="true">·</span>
      <span>
        {ended} terminée{ended > 1 ? "s" : ""}
      </span>
    </div>
  );
}
