import { ClipboardList, Trophy, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { AdminMyProspectsKpis as Kpis } from "@/src/services/admin-my-prospects.service";

type AdminMyProspectsKpisProps = {
  kpis: Kpis;
};

type KpiCard = {
  label: string;
  value: number;
  icon: LucideIcon;
};

export default function AdminMyProspectsKpis({
  kpis,
}: AdminMyProspectsKpisProps) {
  const cards: KpiCard[] = [
    { label: "Total", value: kpis.total, icon: Users },
    { label: "À suivre", value: kpis.toFollowUp, icon: ClipboardList },
    { label: "Gagnés", value: kpis.won, icon: Trophy },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <div
            key={card.label}
            className="flex items-center gap-4 rounded-3xl border border-slate-200 bg-white p-5"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100">
              <Icon className="h-6 w-6 text-blue-600" />
            </div>

            <div>
              <p className="text-3xl font-bold text-[#0f2557]">
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
