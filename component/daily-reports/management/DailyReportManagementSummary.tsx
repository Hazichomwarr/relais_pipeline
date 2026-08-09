import type { DailyReportManagementDashboard } from "@/src/services/daily-report.service-core";

export default function DailyReportManagementSummary({
  summary,
}: {
  summary: DailyReportManagementDashboard["summary"];
}) {
  const completionRate =
    summary.expected > 0 ? Math.round((summary.submitted / summary.expected) * 100) : null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <SummaryCard label="Attendus" value={summary.expected} />
      <SummaryCard label="Envoyés" value={summary.submitted} accent="text-emerald-700" />
      <SummaryCard label="Brouillons" value={summary.draft} accent="text-amber-700" />
      <SummaryCard label="Non commencés" value={summary.notStarted} accent="text-slate-500" />

      {completionRate !== null && (
        <p className="col-span-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 sm:col-span-4">
          {summary.submitted} / {summary.expected} envoyés — {completionRate}&nbsp;%
        </p>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ?? "text-slate-800"}`}>{value}</p>
    </div>
  );
}
