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
    <div className="mt-8 rounded-4xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold sm:text-2xl">
          Répartition par produit RELAIS
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {total} prospect{total > 1 ? "s" : ""} selon les filtres actuels
          — un même prospect peut compter ici sans figurer dans la file de
          suivi, qui ne liste que les suivis à traiter.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${item.color}`}
                >
                  <Icon className="h-6 w-6" />
                </div>

                <div className="min-w-0">
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
