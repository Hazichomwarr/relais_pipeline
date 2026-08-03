import {
  CheckCircle2,
  Clock,
  PhoneCall,
  TrendingUp,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

import { performanceColor } from "@/src/lib/commercial-dashboard-presentation";
import type { CommercialDashboard } from "@/src/services/commercial-dashboard.service";

type CommercialKpiCardsProps = {
  kpis: CommercialDashboard["kpis"];
};

const toneClasses = {
  positive: "bg-emerald-100 text-emerald-600",
  warning: "bg-amber-100 text-amber-600",
  critical: "bg-red-100 text-red-600",
  neutral: "bg-slate-100 text-slate-500",
} as const;

type KpiCard = {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: keyof typeof toneClasses;
};

export default function CommercialKpiCards({ kpis }: CommercialKpiCardsProps) {
  const cards: KpiCard[] = [
    {
      label: "Mes prospects",
      value: String(kpis.totalAssignedProspects),
      icon: Users,
      tone: "neutral",
    },
    {
      label: "Suivis aujourd’hui",
      value: String(kpis.followUpsToday),
      icon: PhoneCall,
      tone: kpis.followUpsToday > 0 ? "warning" : "neutral",
    },
    {
      label: "Suivis en retard",
      value: String(kpis.overdueProspects),
      icon: Clock,
      tone: kpis.overdueProspects > 0 ? "critical" : "neutral",
    },
    {
      label: "Qualifiés",
      value: String(kpis.qualifiedProspects),
      icon: CheckCircle2,
      tone: "neutral",
    },
    {
      label: "Gagnés",
      value: String(kpis.wonProspects),
      icon: Trophy,
      tone: "positive",
    },
    {
      label: "Taux de conversion",
      value:
        kpis.conversionRate === null
          ? "—"
          : `${Math.round(kpis.conversionRate)}%`,
      icon: TrendingUp,
      tone: performanceColor(kpis.conversionRate),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <div
            key={card.label}
            className="flex items-center gap-4 rounded-3xl border border-slate-200 bg-white p-5"
          >
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${toneClasses[card.tone]}`}
            >
              <Icon className="h-6 w-6" />
            </div>

            <div>
              <p className="text-3xl font-bold text-slate-900">
                {card.value}
              </p>
              <p className="text-sm text-slate-500">{card.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
