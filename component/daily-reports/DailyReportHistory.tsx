import Link from "next/link";

import DailyReportStatusBadge from "@/component/daily-reports/DailyReportStatusBadge";
import { getDailyReportTemplateTypeLabel } from "@/src/lib/constants/daily-report-options";
import { formatDailyReportTime, formatLongDailyReportDate } from "@/src/lib/daily-report-date";
import type { DailyReportRow } from "@/src/services/daily-report.service-core";

export default function DailyReportHistory({
  reports,
}: {
  reports: DailyReportRow[];
}) {
  return (
    <ul className="space-y-3">
      {reports.map((report) => (
        <li
          key={report.id}
          className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-semibold text-slate-800">
              {formatLongDailyReportDate(report.reportDate)}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {getDailyReportTemplateTypeLabel(report.templateType)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <DailyReportStatusBadge status={report.status} />
              {report.submittedAt && (
                <span className="text-xs text-slate-400">
                  Envoyé à {formatDailyReportTime(report.submittedAt)}
                </span>
              )}
            </div>
          </div>

          <Link
            href={`/reports/${report.id}`}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            {report.status === "DRAFT" ? "Continuer" : "Voir"}
          </Link>
        </li>
      ))}
    </ul>
  );
}
