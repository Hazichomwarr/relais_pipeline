import LedgerEntryCategoryBadge from "@/component/finances/LedgerEntryCategoryBadge";
import { formatXofAmount } from "@/src/lib/financial-ledger-format";
import type { FinancialReportExpenseCategory } from "@/src/services/financial-report.service-core";

export default function ExpenseCategoryBreakdown({
  expenseCategories,
}: {
  expenseCategories: FinancialReportExpenseCategory[];
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-bold text-[#0f2557]">Sorties par catégorie</h2>

      {expenseCategories.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          Aucune sortie enregistrée sur cette période.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {expenseCategories.map((row) => (
            <li key={row.category}>
              <div className="flex items-baseline justify-between gap-3">
                <LedgerEntryCategoryBadge category={row.category} />
                <p className="font-bold text-slate-900">
                  {formatXofAmount(row.amount)}
                </p>
              </div>
              <p className="mt-1.5 text-sm text-slate-500">
                {row.entryCount} écriture{row.entryCount > 1 ? "s" : ""} ·{" "}
                {row.percentOfOutflows} % des sorties
              </p>
              <div
                className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100"
                role="presentation"
              >
                <div
                  className="h-full rounded-full bg-red-400"
                  style={{ width: `${row.percentOfOutflows}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
