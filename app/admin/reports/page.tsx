import DailyReportAttentionSection from "@/component/daily-reports/management/DailyReportAttentionSection";
import DailyReportManagementFilters from "@/component/daily-reports/management/DailyReportManagementFilters";
import DailyReportManagementHistory from "@/component/daily-reports/management/DailyReportManagementHistory";
import DailyReportManagementSummary from "@/component/daily-reports/management/DailyReportManagementSummary";
import DailyReporterCard from "@/component/daily-reports/management/DailyReporterCard";
import {
  formatLongDailyReportDate,
  getCurrentBusinessDate,
  resolveDailyReportHistoryRange,
} from "@/src/lib/daily-report-date";
import { addBusinessDays } from "@/src/lib/financial-report-period";
import {
  parseDailyReportManagementFilters,
  type DailyReportManagementFilterParams,
} from "@/src/lib/validations/daily-report-management-filters.schema";
import {
  getDailyReportManagementDashboard,
  listDailyReportEmployeeOptions,
  listDailyReportsForManagement,
} from "@/src/services/daily-report.service";
import { filterDailyReporterStatuses } from "@/src/services/daily-report.service-core";

type ReportsSearchParams = Promise<DailyReportManagementFilterParams>;

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: ReportsSearchParams;
}) {
  // Authorization already happened in app/admin/reports/layout.tsx
  // (requireDailyReportManagementAccess) before this page ever fetches
  // report data.
  const params = await searchParams;
  const filters = parseDailyReportManagementFilters(params);
  const period = filters.period ?? "today";
  const employees = await listDailyReportEmployeeOptions();

  if (period !== "today") {
    // Historical periods show real persisted reports only — never a
    // derived NOT_STARTED state, which has no meaning outside today.
    const { dateFrom, dateTo } = resolveDailyReportHistoryRange(
      period === "last7" ? 7 : 30,
    );
    const reports = await listDailyReportsForManagement({
      ownerUserId: filters.employeeId,
      templateType: filters.templateType,
      status: filters.state === "NOT_STARTED" ? undefined : filters.state,
      dateFrom,
      dateTo,
    });

    return (
      <div className="space-y-8">
        <PageHeader />
        <DailyReportManagementFilters filters={filters} employees={employees} />

        {reports.length === 0 ? (
          <p className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-500">
            Aucun rapport pour cette période.
          </p>
        ) : (
          <DailyReportManagementHistory reports={reports} />
        )}
      </div>
    );
  }

  const today = getCurrentBusinessDate();
  const dashboard = await getDailyReportManagementDashboard(today);
  const visibleReporters = filterDailyReporterStatuses(dashboard.reporters, {
    employeeId: filters.employeeId,
    templateType: filters.templateType,
    state: filters.state,
  });

  // "Historique récent" below today's dashboard — the last 7 days *before*
  // today, so it never duplicates what the sections above already show.
  const recentHistory = await listDailyReportsForManagement({
    ownerUserId: filters.employeeId,
    templateType: filters.templateType,
    status: filters.state === "NOT_STARTED" ? undefined : filters.state,
    dateFrom: resolveDailyReportHistoryRange(7).dateFrom,
    dateTo: addBusinessDays(today, -1),
  });

  return (
    <div className="space-y-10">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
          Rapports quotidiens
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0f2557] md:text-4xl">
          {formatLongDailyReportDate(today)}
        </h1>
      </header>

      <DailyReportManagementSummary summary={dashboard.summary} />

      <DailyReportManagementFilters filters={filters} employees={employees} />

      <section>
        <h2 className="mb-4 text-xl font-bold text-[#0f2557]">
          À traiter aujourd’hui
        </h2>
        {visibleReporters.length === 0 ? (
          <p className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-500">
            {dashboard.reporters.length === 0
              ? "Aucun employé actif n’a de modèle de rapport quotidien attribué."
              : "Aucun rapporteur ne correspond à ces filtres."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {visibleReporters.map((reporter) => (
              <DailyReporterCard key={reporter.user.id} reporter={reporter} />
            ))}
          </div>
        )}
      </section>

      <DailyReportAttentionSection
        title="Décisions requises"
        emptyMessage="Aucune décision de la Direction signalée aujourd’hui."
        items={dashboard.decisionsRequired}
      />

      <DailyReportAttentionSection
        title="Problèmes signalés"
        emptyMessage="Aucun problème signalé aujourd’hui."
        items={dashboard.problemsReported}
      />

      <section>
        <h2 className="mb-4 text-xl font-bold text-[#0f2557]">Historique récent</h2>
        {recentHistory.length === 0 ? (
          <p className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-500">
            Aucun rapport pour cette période.
          </p>
        ) : (
          <DailyReportManagementHistory reports={recentHistory} />
        )}
      </section>
    </div>
  );
}

function PageHeader() {
  return (
    <header>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
        Rapports quotidiens
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0f2557] md:text-4xl">
        Historique des rapports
      </h1>
    </header>
  );
}
