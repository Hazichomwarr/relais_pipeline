import { getProductLabel } from "@/component/propects/prospect-detail-sections";
import { getConversionReasonLabel } from "@/src/lib/prospect-conversion-options";
import type { SalesWhyProductEntry } from "@/src/services/sales-why-analytics.service-core";

/**
 * Top reasons per product — not every reason for every product. Only
 * products with structured data in the current scope appear (the core
 * already filters zero-total products out).
 */
export default function ProductReasonBreakdown({
  byProduct,
}: {
  byProduct: SalesWhyProductEntry[];
}) {
  if (byProduct.length === 0) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold text-[#0f2557]">Raisons par produit</h2>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {byProduct.map((entry) => (
          <div key={entry.product} className="rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">{getProductLabel(entry.product)}</h3>
              <span className="text-sm text-slate-500">
                {entry.total} suivi{entry.total > 1 ? "s" : ""}
              </span>
            </div>
            <ol className="mt-3 space-y-1.5 text-sm text-slate-600">
              {entry.topReasons.map((reason, index) => (
                <li key={reason.reason}>
                  {index + 1}. {getConversionReasonLabel(reason.reason)} — {reason.count}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
