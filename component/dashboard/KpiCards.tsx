import type { ProspectListItem } from "@/src/services/prospect.service";
import { getAssignedUserName } from "@/src/lib/prospect-ownership";
import {
  computeReadyToDiscussSummary,
  isInterestedProspect,
} from "@/src/services/prospect-status.service-core";
import { CircleCheck, Flame, Trophy, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";

type KpiCardsProps = {
  prospects: ProspectListItem[];
};

type KpiCard = {
  label: string;
  total: number;
  indicator: string;
  icon: LucideIcon;
  href?: string;
};

export default function KpiCards({ prospects }: KpiCardsProps) {
  const uniqueAgents = new Set(
    prospects.map((prospect) => getAssignedUserName(prospect)),
  ).size;

  const interested = prospects.filter((prospect) =>
    isInterestedProspect(prospect.interest),
  ).length;

  const interestedPercent =
    prospects.length === 0
      ? 0
      : Math.round((interested / prospects.length) * 100);

  const readyToDiscuss = computeReadyToDiscussSummary(prospects);

  const won = prospects.filter((prospect) => prospect.status === "WON").length;

  const cards: KpiCard[] = [
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
      label: "Prêts à discuter",
      total: readyToDiscuss.count,
      indicator: `${readyToDiscuss.percentage}% du total`,
      icon: CircleCheck,
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

        const content = (
          <div
            key={card.label}
            className="h-full rounded-3xl border border-blue-200 bg-white p-5 transition hover:border-blue-300 sm:p-6"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-100 sm:h-16 sm:w-16">
                <Icon className="h-7 w-7 text-blue-600 sm:h-8 sm:w-8" />
              </div>

              <div className="min-w-0">
                <h2 className="text-4xl font-bold sm:text-5xl">
                  {card.total}
                </h2>
                <p className="text-slate-500">{card.label}</p>
                <p className="mt-1 font-medium text-blue-600">
                  {card.indicator}
                </p>
              </div>
            </div>
          </div>
        );

        return card.href ? (
          <Link key={card.label} href={card.href}>
            {content}
          </Link>
        ) : (
          content
        );
      })}
    </div>
  );
}
