import { ArrowUpRight, Ban, ClipboardList, Trophy, XCircle } from "lucide-react";

import type { SalesWhyAnalyticsSummary } from "@/src/services/sales-why-analytics.service-core";

/**
 * The unit here is a structured follow-up event, not a unique prospect —
 * wording must never imply prospect counts (Ticket 20G).
 */
export default function WhyAnalyticsSummary({
  summary,
}: {
  summary: SalesWhyAnalyticsSummary;
}) {
  const cards = [
    { label: "Suivis structurés", value: summary.structuredFollowUps, icon: ClipboardList, tone: "bg-slate-100 text-slate-700" },
    { label: "Avancés", value: summary.advanced, icon: ArrowUpRight, tone: "bg-blue-100 text-blue-700" },
    { label: "Bloqués", value: summary.stalled, icon: Ban, tone: "bg-amber-100 text-amber-700" },
    { label: "Gagnés", value: summary.won, icon: Trophy, tone: "bg-emerald-100 text-emerald-700" },
    { label: "Perdus", value: summary.lost, icon: XCircle, tone: "bg-red-100 text-red-700" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
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
              <p className="text-3xl font-bold text-[#0f2557]">{card.value}</p>
              <p className="text-sm text-slate-500">{card.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
