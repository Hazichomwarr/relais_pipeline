import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import DailyReportReadOnlyView from "@/component/daily-reports/DailyReportReadOnlyView";
import DailyReportStatusBadge from "@/component/daily-reports/DailyReportStatusBadge";
import { getDailyReportTemplateTypeLabel } from "@/src/lib/constants/daily-report-options";
import { formatLongDailyReportDate } from "@/src/lib/daily-report-date";
import { getDailyReportForManagement } from "@/src/services/daily-report.service";

type ManagementReportDetailPageProps = {
  params: Promise<{ reportId: string }>;
};

/**
 * Management read-only detail (Ticket 19C) — authorization already
 * happened in app/admin/reports/layout.tsx. Renders from the report's own
 * stored templateType/templateData, never the owner's current template
 * assignment, so a historical report always renders as it was submitted.
 * No edit, resubmit, or delete control exists on this page — DailyReportReadOnlyView
 * (Ticket 19B) is purely presentational and has no mutation path at all.
 */
export default async function ManagementReportDetailPage({
  params,
}: ManagementReportDetailPageProps) {
  const { reportId } = await params;

  const report = await getDailyReportForManagement(reportId);

  if (!report) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin/reports"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux rapports quotidiens
      </Link>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <DailyReportStatusBadge status={report.status} />
        <span className="text-sm text-slate-400">
          {getDailyReportTemplateTypeLabel(report.templateType)}
        </span>
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-[#0f2557] md:text-4xl">
        {report.owner.firstName} {report.owner.lastName}
      </h1>
      <p className="mt-1 text-lg text-slate-500">
        {formatLongDailyReportDate(new Date(report.reportDate))}
      </p>

      {report.status === "DRAFT" && (
        <p className="mt-3 text-sm font-semibold text-amber-700">
          Brouillon — non encore envoyé
        </p>
      )}

      <section className="mt-7 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <DailyReportReadOnlyView
          report={{
            status: report.status,
            templateType: report.templateType,
            accomplishedToday: report.accomplishedToday,
            plannedTomorrow: report.plannedTomorrow,
            templateData: report.templateData,
            submittedAt: report.submittedAt ? new Date(report.submittedAt) : null,
          }}
        />
      </section>
    </div>
  );
}
