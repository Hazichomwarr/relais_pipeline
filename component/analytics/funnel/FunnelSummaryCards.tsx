import { Flame, Target, Trophy, Users, XCircle, type LucideIcon } from "lucide-react";

import type { SalesFunnelSummary } from "@/src/services/sales-funnel-analytics.service-core";

function formatRate(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1).replace(".", ",")}%`;
}

export default function FunnelSummaryCards({
  summary,
}: {
  summary: SalesFunnelSummary;
}) {
  const cards: Array<{ label: string; value: string; icon: LucideIcon; tone: string }> = [
    {
      label: "Prospects",
      value: String(summary.totalProspects),
      icon: Users,
      tone: "bg-blue-100 text-blue-700",
    },
    {
      label: "Intéressés",
      value: String(summary.interestedProspects),
      icon: Flame,
      tone: "bg-amber-100 text-amber-700",
    },
    {
      label: "Gagnés",
      value: String(summary.wonProspects),
      icon: Trophy,
      tone: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Perdus",
      value: String(summary.lostProspects),
      icon: XCircle,
      tone: "bg-red-100 text-red-700",
    },
    {
      label: "Taux de conversion",
      value: formatRate(summary.conversionRate),
      icon: Target,
      tone: "bg-slate-100 text-slate-700",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
