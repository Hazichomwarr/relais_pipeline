import Link from "next/link";

import type { FinancialReportPeriodKey } from "@/src/lib/validations/financial-report-filter.schema";

const presetPeriods: { value: Exclude<FinancialReportPeriodKey, "custom">; label: string }[] = [
  { value: "today", label: "Aujourd’hui" },
  { value: "week", label: "Cette semaine" },
  { value: "month", label: "Ce mois" },
  { value: "year", label: "Cette année" },
];

const fieldClassName =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100";

/**
 * No client JS: preset periods are plain links (the period lives in the
 * URL, so a normal navigation is enough — Ticket 17C), and the custom
 * range is a native GET form that updates the same URL params on submit.
 */
export default function FinancialReportPeriodFilter({
  requestedPeriod,
  fromDateLabel,
  toDateLabel,
}: {
  /** The raw ?period= value, so "Personnalisé" stays highlighted and its
   * form stays open even when the range fell back to a default (e.g. no
   * dates chosen yet), instead of silently jumping to another tab. */
  requestedPeriod: FinancialReportPeriodKey;
  fromDateLabel: string;
  toDateLabel: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <nav
        aria-label="Choisir la période du rapport"
        className="flex flex-wrap gap-2"
      >
        {presetPeriods.map((preset) => (
          <Link
            key={preset.value}
            href={`/finances/reports?period=${preset.value}`}
            aria-current={requestedPeriod === preset.value ? "page" : undefined}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              requestedPeriod === preset.value
                ? "bg-blue-50 text-blue-600"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {preset.label}
          </Link>
        ))}
        <Link
          href="/finances/reports?period=custom"
          aria-current={requestedPeriod === "custom" ? "page" : undefined}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            requestedPeriod === "custom"
              ? "bg-blue-50 text-blue-600"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Personnalisé
        </Link>
      </nav>

      {requestedPeriod === "custom" && (
        <form
          method="GET"
          action="/finances/reports"
          className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-end"
        >
          <input type="hidden" name="period" value="custom" />

          <label className="flex-1">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Du
            </span>
            <input
              type="date"
              name="from"
              defaultValue={fromDateLabel}
              required
              className={fieldClassName}
            />
          </label>

          <label className="flex-1">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Au
            </span>
            <input
              type="date"
              name="to"
              defaultValue={toDateLabel}
              required
              className={fieldClassName}
            />
          </label>

          <button
            type="submit"
            className="h-12 rounded-xl bg-[#0f2557] px-6 font-semibold text-white transition hover:bg-[#18366f]"
          >
            Appliquer
          </button>
        </form>
      )}
    </div>
  );
}
