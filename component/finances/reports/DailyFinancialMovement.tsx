import { formatXofAmount } from "@/src/lib/financial-ledger-format";
import type { FinancialReportDailyMovement } from "@/src/services/financial-report.service-core";

function formatDailyMovementDate(isoDate: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

export default function DailyFinancialMovement({
  dailyMovement,
}: {
  dailyMovement: FinancialReportDailyMovement[];
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-bold text-[#0f2557]">Mouvements par jour</h2>

      {dailyMovement.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          Aucun mouvement quotidien à afficher.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {dailyMovement.map((row) => {
            const isNetNegative = row.net.startsWith("-");

            return (
              <li key={row.date} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="font-semibold text-slate-800">
                    {formatDailyMovementDate(row.date)}
                  </p>
                  <p
                    className={`font-bold ${isNetNegative ? "text-red-600" : "text-emerald-700"}`}
                  >
                    Net {isNetNegative ? "" : "+"}
                    {formatXofAmount(row.net)}
                  </p>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Entrées : {formatXofAmount(row.inflows)} · Sorties :{" "}
                  {formatXofAmount(row.outflows)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
