import { KpiCard } from "@/app/admin/page";
import { FileText } from "lucide-react";

export default function KpiCards({ kpiCards }: { kpiCards: KpiCard[] }) {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {kpiCards.map((k, idx) => (
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
