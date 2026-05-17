import { FileText } from "lucide-react";

export type KpiCard = { label: string; total?: number; indicator?: string };

const KPI_CARDS: KpiCard[] = [
  { label: "Total Rapports", total: 58, indicator: "+12 ce mois" },
  { label: "Entreprises uniques", total: 23, indicator: "+5 ce mois" },
  { label: "Commerciaux", total: 3, indicator: "Actif" },
  { label: "Intéressés", total: 17, indicator: "29% du total" },
];

export default function KpiCards() {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {KPI_CARDS.map((k, idx) => (
        <div
          key={idx}
          className="rounded-3xl border border-blue-200 bg-white p-6"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <FileText className="h-8 w-8 text-blue-600" />
            </div>

            <div>
              <h2 className="text-5xl font-bold">{k.total}</h2>
              <p className="text-slate-500">{k.label}</p>
              <p className="mt-1 font-medium text-blue-600">{k.indicator}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
