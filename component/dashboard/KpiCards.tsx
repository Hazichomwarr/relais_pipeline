import type { ProspectListItem } from "@/src/services/prospect.service";
import { FileText, Flame, Trophy, Users, type LucideIcon } from "lucide-react";

type KpiCardsProps = {
  prospects: ProspectListItem[];
};

type KpiCard = {
  label: string;
  total: number;
  indicator: string;
  icon: LucideIcon;
};

export default function KpiCards({ prospects }: KpiCardsProps) {
  const uniqueAgents = new Set(prospects.map((prospect) => prospect.agentName))
    .size;

  const interested = prospects.filter((prospect) =>
    ["INTERESTED", "READY_TO_DISCUSS"].includes(prospect.interest),
  ).length;

  const won = prospects.filter((prospect) => prospect.status === "WON").length;

  const interestedPercent =
    prospects.length === 0
      ? 0
      : Math.round((interested / prospects.length) * 100);

  const cards: KpiCard[] = [
    {
      label: "Total prospects",
      total: prospects.length,
      indicator: "Dans la sélection actuelle",
      icon: FileText,
    },
    {
      label: "Commerciaux",
      total: uniqueAgents,
      indicator: "Agents représentés",
      icon: Users,
    },
    {
      label: "Prospects intéressés",
      total: interested,
      indicator: `${interestedPercent}% du total`,
      icon: Flame,
    },
    {
      label: "Opportunités gagnées",
      total: won,
      indicator: "Statut gagné",
      icon: Trophy,
    },
  ];

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <div
            key={card.label}
            className="rounded-3xl border border-blue-200 bg-white p-6"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <Icon className="h-8 w-8 text-blue-600" />
              </div>

              <div>
                <h2 className="text-5xl font-bold">{card.total}</h2>
                <p className="text-slate-500">{card.label}</p>
                <p className="mt-1 font-medium text-blue-600">
                  {card.indicator}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
