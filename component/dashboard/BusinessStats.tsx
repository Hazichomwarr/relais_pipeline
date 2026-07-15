import type { ProspectListItem } from "@/src/services/prospect.service";
import {
  Building2,
  GraduationCap,
  PiggyBank,
  Store,
  type LucideIcon,
} from "lucide-react";

type BusinessStatsProps = {
  prospects: ProspectListItem[];
};

type ProductStatConfig = {
  product: ProspectListItem["product"];
  label: string;
  icon: LucideIcon;
  color: string;
};

const productStats: ProductStatConfig[] = [
  {
    product: "KARMDA",
    label: "Écoles",
    icon: GraduationCap,
    color: "bg-blue-100 text-blue-600",
  },
  {
    product: "LOKARI",
    label: "Immobilier",
    icon: Building2,
    color: "bg-emerald-100 text-emerald-600",
  },
  {
    product: "NIA",
    label: "Groupes d’épargne",
    icon: PiggyBank,
    color: "bg-violet-100 text-violet-600",
  },
  {
    product: "DIGITAL_SERVICES",
    label: "Services digitaux",
    icon: Store,
    color: "bg-amber-100 text-amber-600",
  },
];

export default function BusinessStats({ prospects }: BusinessStatsProps) {
  const total = prospects.length;

  return (
    <div className="mt-8 rounded-4xl border border-slate-200 bg-white p-6">
      <h2 className="mb-6 text-2xl font-bold">
        Répartition par produit RELAIS
      </h2>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {productStats.map((item) => {
          const Icon = item.icon;

          const count = prospects.filter(
            (prospect) => prospect.product === item.product,
          ).length;

          const percent = total === 0 ? 0 : Math.round((count / total) * 100);

          return (
            <div
              key={item.product}
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
                    <span className="text-sm text-slate-500">{percent}%</span>
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
