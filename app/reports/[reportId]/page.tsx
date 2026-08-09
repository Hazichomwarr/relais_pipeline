import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import AssistantDailyReportForm from "@/component/daily-reports/AssistantDailyReportForm";
import DailyReportReadOnlyView from "@/component/daily-reports/DailyReportReadOnlyView";
import DailyReportStatusBadge from "@/component/daily-reports/DailyReportStatusBadge";
import OperationsCoordinatorDailyReportForm from "@/component/daily-reports/OperationsCoordinatorDailyReportForm";
import { getDailyReportTemplateTypeLabel } from "@/src/lib/constants/daily-report-options";
import { formatLongDailyReportDate } from "@/src/lib/daily-report-date";
import type { AssistantDailyReportData } from "@/src/lib/validations/assistant-daily-report.schema";
import type { OperationsCoordinatorDailyReportData } from "@/src/lib/validations/operations-coordinator-daily-report.schema";
import {
  AuthorizationError,
  requireAuthenticatedUser,
} from "@/src/services/authorization.service";
import { getOwnDailyReportById } from "@/src/services/daily-report.service";

type DailyReportDetailPageProps = {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ saved?: string; submitted?: string }>;
};

export default async function DailyReportDetailPage({
  params,
  searchParams,
}: DailyReportDetailPageProps) {
  const { reportId } = await params;
  const { saved, submitted } = await searchParams;

  let user;

  try {
    user = await requireAuthenticatedUser();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect("/login");
    }
    throw error;
  }

  // Owner-scoped — a foreign or unknown reportId both resolve to null, so
  // not-found.tsx never hints at which case occurred (see its comment).
  const report = await getOwnDailyReportById(user.id, reportId);

  if (!report) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/reports"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à mes rapports
      </Link>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <DailyReportStatusBadge status={report.status} />
        <span className="text-sm text-slate-400">
          {getDailyReportTemplateTypeLabel(report.templateType)}
        </span>
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-[#0f2557] md:text-4xl">
        {formatLongDailyReportDate(report.reportDate)}
      </h1>

      {saved === "1" && (
        <div
          role="status"
          className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          Brouillon enregistré.
        </div>
      )}
      {submitted === "1" && (
        <div
          role="status"
          className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          Rapport envoyé avec succès.
        </div>
      )}

      <section className="mt-7 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        {report.status === "SUBMITTED" ? (
          <DailyReportReadOnlyView report={report} />
        ) : report.templateType === "ASSISTANT" ? (
          <AssistantDailyReportForm
            mode="edit"
            reportId={report.id}
            defaultValues={{
              accomplishedToday: report.accomplishedToday,
              plannedTomorrow: report.plannedTomorrow,
              ...(report.templateData as AssistantDailyReportData),
            }}
          />
        ) : (
          <OperationsCoordinatorDailyReportForm
            mode="edit"
            reportId={report.id}
            defaultValues={{
              accomplishedToday: report.accomplishedToday,
              plannedTomorrow: report.plannedTomorrow,
              ...(report.templateData as OperationsCoordinatorDailyReportData),
            }}
          />
        )}
      </section>
    </div>
  );
}
