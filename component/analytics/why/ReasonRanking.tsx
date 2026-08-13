import { getConversionReasonLabel } from "@/src/lib/prospect-conversion-options";
import type { SalesWhyReasonEntry } from "@/src/services/sales-why-analytics.service-core";

function formatPercentage(value: number): string {
  return `${value.toFixed(0)}%`;
}

/**
 * "Raisons observées" — the main ranking. Percentages are relative to all
 * structured follow-ups currently in scope (never to a per-outcome subset —
 * see WhyAnalytics DTO percentage semantics).
 */
export default function ReasonRanking({
  reasons,
  title = "Raisons observées",
  emptyMessage = "Aucune raison structurée pour cette période et ces filtres.",
}: {
  reasons: SalesWhyReasonEntry[] | Array<{ reason: SalesWhyReasonEntry["reason"]; count: number; percentage: number }>;
  title?: string;
  emptyMessage?: string;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold text-[#0f2557]">{title}</h2>

      {reasons.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center text-sm text-slate-500">
          {emptyMessage}
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {reasons.map((entry) => (
            <li key={entry.reason}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-slate-700">
                  {getConversionReasonLabel(entry.reason)}
                </span>
                <span className="shrink-0 text-slate-500">
                  {entry.count} · {formatPercentage(entry.percentage)}
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[#0f2557]"
                  style={{ width: `${Math.min(entry.percentage, 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
