import { LucideIcon } from "lucide-react";
import {
  Dumbbell,
  MoreHorizontal,
  Scissors,
  Smartphone,
  Utensils,
} from "lucide-react";
import { Report } from "../propects/prospect-form-input";

export type Category =
  | "restaurant"
  | "gym"
  | "salon"
  | "tech-shop"
  | "grocery-store"
  | "clinic"
  | "barbershop"
  | "autres";

export type BusinessStatType = {
  slug: Category;
  label: string;
  value: number;
  percent: string;
  icon: LucideIcon;
  color: string;
};

const businessStats: BusinessStatType[] = [
  {
    slug: "restaurant",
    label: "Restaurant",
    value: 20,
    percent: "34%",
    icon: Utensils,
    color: "bg-blue-100 text-blue-600",
  },
  {
    slug: "gym",
    label: "Salle de sport",
    value: 12,
    percent: "21%",
    icon: Dumbbell,
    color: "bg-green-100 text-green-600",
  },
  {
    slug: "salon",
    label: "Salon de coiffure",
    value: 9,
    percent: "16%",
    icon: Scissors,
    color: "bg-violet-100 text-violet-600",
  },
  {
    slug: "tech-shop",
    label: "Boutique tech",
    value: 6,
    percent: "10%",
    icon: Smartphone,
    color: "bg-indigo-100 text-indigo-600",
  },

  {
    slug: "barbershop",
    label: "Barbershop",
    value: 2,
    percent: "3%",
    icon: Scissors,
    color: "bg-amber-100 text-amber-600",
  },
  // {slug: "",
  //   label: "Bijouterie",
  //   value: 4,
  //   percent: "7%",
  //   icon: Gem,
  //   color: "bg-amber-100 text-amber-600",
  // },
  {
    slug: "autres",
    label: "Autres",
    value: 7,
    percent: "12%",
    icon: MoreHorizontal,
    color: "bg-slate-100 text-slate-600",
  },
];

export default function BusinessStats({ reports }: { reports: Report[] }) {
  return (
    <div className="mt-8 rounded-4xl border border-slate-200 bg-white p-6">
      <h2 className="mb-6 text-2xl font-bold">
        Répartition par type de business
      </h2>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {businessStats.map((item) => {
          const Icon = item.icon;
          const count = reports.filter((r) => r.type === item.slug).length;

          return (
            <div
              key={item.slug}
              className="rounded-2xl border border-slate-200 p-4"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full ${item.color}`}
                >
                  <Icon className="h-6 w-6" />
                </div>

                <div>
                  <p className="text-sm text-slate-500">{item.label}</p>

                  <div className="mt-1 flex items-center gap-3">
                    <span className="text-3xl font-bold">{count}</span>

                    <span className="text-sm text-slate-500">
                      {item.percent}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
