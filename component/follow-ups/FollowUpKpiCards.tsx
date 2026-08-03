import {
  CalendarDays,
  ClockAlert,
  MessagesSquare,
  PhoneCall,
  type LucideIcon,
} from "lucide-react";

type FollowUpKpis = {
  dueToday: number;
  overdue: number;
  thisWeek: number;
  readyToDiscuss: number;
};

export default function FollowUpKpiCards({ kpis }: { kpis: FollowUpKpis }) {
  const cards: Array<{
    label: string;
    total: number;
    detail: string;
    icon: LucideIcon;
    tone: string;
  }> = [
    {
      label: "Prospects à rappeler aujourd’hui",
      total: kpis.dueToday,
      detail: "Dans la file d’action",
      icon: PhoneCall,
      tone: "bg-blue-100 text-blue-700",
    },
    {
      label: "En retard",
      total: kpis.overdue,
      detail: "Date de suivi dépassée",
      icon: ClockAlert,
      tone: "bg-red-100 text-red-700",
    },
    {
      label: "Cette semaine",
      total: kpis.thisWeek,
      detail: "Aujourd’hui et 7 jours à venir",
      icon: CalendarDays,
      tone: "bg-amber-100 text-amber-700",
    },
    {
      label: "Prêts à discuter",
      total: kpis.readyToDiscuss,
      detail: "Dans la file actuelle",
      icon: MessagesSquare,
      tone: "bg-green-100 text-green-700",
    },
  ];

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <div
            key={card.label}
            className="rounded-3xl border border-slate-200 bg-white p-6"
          >
            <div className="flex items-center gap-4">
              <div
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${card.tone}`}
              >
                <Icon className="h-7 w-7" />
              </div>
              <div>
                <p className="text-4xl font-bold text-[#0f2557]">
                  {card.total}
                </p>
                <h2 className="font-medium text-slate-700">{card.label}</h2>
                <p className="mt-1 text-sm text-slate-500">{card.detail}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
