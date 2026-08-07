import { getPaymentMethodLabel } from "@/src/lib/financial-ledger-options";
import { formatXofAmount } from "@/src/lib/financial-ledger-format";
import type { FinancialReportPaymentMethod } from "@/src/services/financial-report.service-core";

/**
 * Labeled "Volume des mouvements" rather than revenue: each row sums
 * inflow and outflow amounts as raw magnitudes (Ticket 17C), so this
 * reflects activity through a channel, never a profit/loss figure.
 */
export default function PaymentMethodBreakdown({
  paymentMethods,
}: {
  paymentMethods: FinancialReportPaymentMethod[];
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-bold text-[#0f2557]">Modes de paiement</h2>
      <p className="mt-1 text-xs text-slate-400">
        Volume des mouvements par mode de paiement
      </p>

      {paymentMethods.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          Aucun mouvement enregistré sur cette période.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {paymentMethods.map((row) => (
            <li
              key={row.paymentMethod}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div>
                <p className="font-semibold text-slate-800">
                  {getPaymentMethodLabel(row.paymentMethod)}
                </p>
                <p className="text-sm text-slate-500">
                  {row.entryCount} mouvement{row.entryCount > 1 ? "s" : ""}
                </p>
              </div>
              <p className="font-bold text-slate-900">
                {formatXofAmount(row.amount)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
