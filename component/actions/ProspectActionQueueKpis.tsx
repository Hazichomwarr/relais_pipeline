import { AlertTriangle, CalendarClock, CalendarDays, ListTodo } from "lucide-react";

import type { ProspectActionQueueSummary } from "@/src/services/prospect-action-queue.service-core";

/**
 * Counts only — no percentages, no charts, no "performance score" (Ticket
 * 20E is an execution cockpit, not analytics). Reflects the currently
 * selected scope/assignee/product/search filters, deliberately not the
 * bucket filter — see summarizeProspectActionQueue.
 */
export default function ProspectActionQueueKpis({
  summary,
}: {
  summary: ProspectActionQueueSummary;
}) {
  const cards = [
    {
      label: "En retard",
      total: summary.overdue,
      icon: AlertTriangle,
      tone: "bg-red-100 text-red-700",
    },
    {
      label: "Aujourd’hui",
      total: summary.today,
      icon: CalendarClock,
      tone: "bg-amber-100 text-amber-700",
    },
    {
      label: "À venir",
      total: summary.upcoming,
      icon: CalendarDays,
      tone: "bg-blue-100 text-blue-700",
    },
    {
      label: "Ouvertes",
      total: summary.totalOpen,
      icon: ListTodo,
      tone: "bg-slate-100 text-slate-700",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <div
            key={card.label}
            className="flex items-center gap-4 rounded-3xl border border-slate-200 bg-white p-5"
          >
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${card.tone}`}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-3xl font-bold text-[#0f2557]">{card.total}</p>
              <p className="text-sm text-slate-500">{card.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
