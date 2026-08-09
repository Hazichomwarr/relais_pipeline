import Link from "next/link";

import DailyReportStatusBadge from "@/component/daily-reports/DailyReportStatusBadge";
import { getDailyReportTemplateTypeLabel } from "@/src/lib/constants/daily-report-options";
import { formatDailyReportTime } from "@/src/lib/daily-report-date";
import { groupDailyReportSummariesByDate } from "@/src/lib/daily-report-management-history-grouping";
import type { DailyReportSummary } from "@/src/services/daily-report.service-core";

/**
 * Always real persisted reports (Ticket 19C) — reuses DailyReportStatusBadge
 * (Ticket 19B), which only ever renders a genuine DRAFT/SUBMITTED status,
 * never DailyReporterStateBadge's derived NOT_STARTED.
 */
export default function DailyReportManagementHistory({
  reports,
}: {
  reports: DailyReportSummary[];
}) {
  const groups = groupDailyReportSummariesByDate(reports);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.reportDate}>
          <p className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">
            {group.label}
          </p>
          <ul className="space-y-2">
            {group.items.map((report) => (
              <li
                key={report.id}
                className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-800">
                    {report.owner.firstName} {report.owner.lastName}
                  </p>
                  <p className="text-sm text-slate-500">
                    {getDailyReportTemplateTypeLabel(report.templateType)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <DailyReportStatusBadge status={report.status} />
                  {report.submittedAt && (
                    <span className="text-xs text-slate-400">
                      Envoyé à {formatDailyReportTime(new Date(report.submittedAt))}
                    </span>
                  )}
                  <Link
                    href={`/admin/reports/${report.id}`}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Voir
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
