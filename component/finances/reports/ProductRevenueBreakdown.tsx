import { getRelaisProductLabel } from "@/component/finances/ledger-presentation";
import { formatXofAmount } from "@/src/lib/financial-ledger-format";
import type { FinancialReportProductRevenue } from "@/src/services/financial-report.service-core";

export default function ProductRevenueBreakdown({
  productRevenue,
}: {
  productRevenue: FinancialReportProductRevenue[];
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-bold text-[#0f2557]">Revenus par produit</h2>

      {productRevenue.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          Aucun paiement client sur cette période.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {productRevenue.map((row) => (
            <li key={row.product}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-semibold text-slate-800">
                  {getRelaisProductLabel(row.product)}
                </p>
                <p className="font-bold text-slate-900">
                  {formatXofAmount(row.amount)}
                </p>
              </div>
              <p className="mt-0.5 text-sm text-slate-500">
                {row.entryCount} paiement{row.entryCount > 1 ? "s" : ""} ·{" "}
                {row.percentOfClientRevenue} % des paiements clients
              </p>
              <div
                className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100"
                role="presentation"
              >
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{ width: `${row.percentOfClientRevenue}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
