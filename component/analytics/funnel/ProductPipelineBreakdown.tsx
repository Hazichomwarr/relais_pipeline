import { getProductLabel, getStatusLabel } from "@/component/propects/prospect-detail-sections";
import type { SalesFunnelProductBreakdown } from "@/src/services/sales-funnel-analytics.service-core";

export default function ProductPipelineBreakdown({
  byProduct,
}: {
  byProduct: SalesFunnelProductBreakdown[];
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold text-[#0f2557]">Par produit</h2>
      <p className="mt-1 text-sm text-slate-500">
        Répartition factuelle — pas de score de performance produit.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {byProduct.map((entry) => (
          <div
            key={entry.product}
            className="rounded-2xl border border-slate-200 p-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">
                {getProductLabel(entry.product)}
              </h3>
              <span className="text-sm text-slate-500">
                {entry.total} prospect{entry.total > 1 ? "s" : ""}
              </span>
            </div>

            <div className="mt-2 flex gap-4 text-sm text-slate-600">
              <span>{entry.won} gagné{entry.won > 1 ? "s" : ""}</span>
              <span>{entry.lost} perdu{entry.lost > 1 ? "s" : ""}</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
              {entry.statusCounts
                .filter((item) => item.count > 0)
                .map((item) => (
                  <span key={item.status}>
                    {getStatusLabel(item.status)} {item.count}
                  </span>
                ))}
              {entry.statusCounts.every((item) => item.count === 0) && (
                <span>Aucun prospect</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
