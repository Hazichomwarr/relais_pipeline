import { Users } from "lucide-react";

import DailyWorkAgentRow from "@/component/daily-work/management/DailyWorkAgentRow";
import { sortAgentsForManagement } from "@/src/lib/daily-work-management-presentation";
import type { DailyWorkAgent } from "@/src/services/daily-work-management.service";

type DailyWorkAgentListProps = {
  agents: DailyWorkAgent[];
  selectedAgentId: string | null;
};

/** Ticket 27G §13/§61 — the roster pane. Calm empty state, never a bordered empty table. */
export default function DailyWorkAgentList({ agents, selectedAgentId }: DailyWorkAgentListProps) {
  if (agents.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center">
        <Users className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-slate-600">
          Aucun agent à afficher aujourd’hui.
        </p>
      </div>
    );
  }

  const sorted = sortAgentsForManagement(agents);

  return (
    <nav aria-label="Agents" className="rounded-3xl border border-slate-200 bg-white p-2">
      <div className="flex flex-col gap-1">
        {sorted.map((agent) => (
          <DailyWorkAgentRow
            key={agent.user.id}
            agent={agent}
            selected={agent.user.id === selectedAgentId}
          />
        ))}
      </div>
    </nav>
  );
}
