import { redirect } from "next/navigation";

import AssistantDailyReportForm from "@/component/daily-reports/AssistantDailyReportForm";
import DailyReportEmptyState from "@/component/daily-reports/DailyReportEmptyState";
import DailyReportHistory from "@/component/daily-reports/DailyReportHistory";
import DailyReportTodayCard from "@/component/daily-reports/DailyReportTodayCard";
import OperationsCoordinatorDailyReportForm from "@/component/daily-reports/OperationsCoordinatorDailyReportForm";
import { getDailyReportTemplateTypeLabel } from "@/src/lib/constants/daily-report-options";
import { getCurrentBusinessDate } from "@/src/lib/daily-report-date";
import {
  AuthorizationError,
  requireAuthenticatedUser,
} from "@/src/services/authorization.service";
import {
  getOwnDailyReportForDate,
  getOwnDailyReportTemplateType,
  listOwnDailyReports,
} from "@/src/services/daily-report.service";

export default async function ReportsPage() {
  let user;

  try {
    user = await requireAuthenticatedUser();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect("/login");
    }
    throw error;
  }

  // Never inferred from user.role (Ticket 19A/19B) — reports and CRM
  // permission roles are separate concepts.
  const [templateType, todayReport, history] = await Promise.all([
    getOwnDailyReportTemplateType(user.id),
    getOwnDailyReportForDate(user.id, getCurrentBusinessDate()),
    listOwnDailyReports(user.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[#0f2557] md:text-4xl">
          Mes rapports
        </h1>
        <p className="mt-2 max-w-xl text-base text-slate-500">
          Votre rapport quotidien et l’historique de vos envois.
        </p>
      </div>

      {!templateType ? (
        <div className="rounded-4xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-lg font-semibold text-slate-800">
            Aucun modèle de rapport quotidien ne vous est attribué.
          </p>
          <p className="mx-auto mt-2 max-w-md text-slate-500">
            Contactez un administrateur si vous pensez devoir soumettre un
            rapport quotidien.
          </p>
        </div>
      ) : (
        <>
          <DailyReportTodayCard report={todayReport} />

          {!todayReport && (
            <section className="mt-6 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <h2 className="mb-6 text-xl font-bold text-[#0f2557]">
                Rapport quotidien — {getDailyReportTemplateTypeLabel(templateType)}
              </h2>
              {templateType === "ASSISTANT" ? (
                <AssistantDailyReportForm mode="create" />
              ) : (
                <OperationsCoordinatorDailyReportForm mode="create" />
              )}
            </section>
          )}
        </>
      )}

      <div className="mt-10">
        <h2 className="mb-4 text-xl font-bold text-[#0f2557]">Historique</h2>
        {history.length === 0 ? (
          <DailyReportEmptyState />
        ) : (
          <DailyReportHistory reports={history} />
        )}
      </div>
    </div>
  );
}
