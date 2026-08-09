import { AlertTriangle, MessageSquareWarning } from "lucide-react";
import Link from "next/link";

import DailyReporterStateBadge from "@/component/daily-reports/management/DailyReporterStateBadge";
import OperationsProspectingSummary from "@/component/daily-reports/management/OperationsProspectingSummary";
import { getDailyReportTemplateTypeLabel } from "@/src/lib/constants/daily-report-options";
import { formatDailyReportTime } from "@/src/lib/daily-report-date";
import type { DailyReporterStatus } from "@/src/services/daily-report.service-core";

export default function DailyReporterCard({
  reporter,
}: {
  reporter: DailyReporterStatus;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-800">
            {reporter.user.firstName} {reporter.user.lastName}
          </p>
          <p className="text-sm text-slate-500">
            {getDailyReportTemplateTypeLabel(reporter.templateType)}
          </p>
        </div>
        <DailyReporterStateBadge state={reporter.state} />
      </div>

      {reporter.submittedAt && (
        <p className="mt-2 text-sm text-slate-500">
          Envoyé à {formatDailyReportTime(new Date(reporter.submittedAt))}
        </p>
      )}

      {reporter.state === "DRAFT" && (
        <p className="mt-2 text-xs font-semibold text-amber-700">
          Brouillon — non encore envoyé
        </p>
      )}

      {reporter.operationsSummary && (
        <div className="mt-4">
          <OperationsProspectingSummary {...reporter.operationsSummary} />
        </div>
      )}

      {(reporter.hasDecisionNeeded || reporter.hasProblemReported) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {reporter.hasDecisionNeeded && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              Décision signalée
            </span>
          )}
          {reporter.hasProblemReported && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800">
              <MessageSquareWarning className="h-3.5 w-3.5" aria-hidden="true" />
              Problème signalé
            </span>
          )}
        </div>
      )}

      {reporter.reportId && (
        <Link
          href={`/admin/reports/${reporter.reportId}`}
          className="mt-4 inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Voir le rapport
        </Link>
      )}
    </div>
  );
}
