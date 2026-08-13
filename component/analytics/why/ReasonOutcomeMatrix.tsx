import { getConversionReasonLabel } from "@/src/lib/prospect-conversion-options";
import type { SalesWhyMatrixRow } from "@/src/services/sales-why-analytics.service-core";

function cell(value: number): string {
  return value === 0 ? "—" : String(value);
}

/**
 * Reason × résultat — the bidirectional view of Ticket 20D's model. Desktop
 * gets a scrollable table (never page-level horizontal overflow — the
 * scroll container is local to this section); mobile gets reason cards.
 */
export default function ReasonOutcomeMatrix({
  matrix,
}: {
  matrix: SalesWhyMatrixRow[];
}) {
  if (matrix.length === 0) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold text-[#0f2557]">Raison × résultat</h2>

      <div className="mt-5 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-4">Raison</th>
              <th className="px-2 py-2 text-right">Avancé</th>
              <th className="px-2 py-2 text-right">Bloqué</th>
              <th className="px-2 py-2 text-right">Gagné</th>
              <th className="px-2 py-2 text-right">Perdu</th>
              <th className="py-2 pl-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => (
              <tr key={row.reason} className="border-b border-slate-100 last:border-0">
                <td className="py-2.5 pr-4 font-medium text-slate-700">
                  {getConversionReasonLabel(row.reason)}
                </td>
                <td className="px-2 py-2.5 text-right text-slate-600">{cell(row.advanced)}</td>
                <td className="px-2 py-2.5 text-right text-slate-600">{cell(row.stalled)}</td>
                <td className="px-2 py-2.5 text-right text-slate-600">{cell(row.won)}</td>
                <td className="px-2 py-2.5 text-right text-slate-600">{cell(row.lost)}</td>
                <td className="py-2.5 pl-2 text-right font-semibold text-[#0f2557]">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 space-y-3 md:hidden">
        {matrix.map((row) => (
          <div key={row.reason} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-700">
                {getConversionReasonLabel(row.reason)}
              </span>
              <span className="text-sm font-semibold text-[#0f2557]">{row.total}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>Avancé {cell(row.advanced)}</span>
              <span>Bloqué {cell(row.stalled)}</span>
              <span>Gagné {cell(row.won)}</span>
              <span>Perdu {cell(row.lost)}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
