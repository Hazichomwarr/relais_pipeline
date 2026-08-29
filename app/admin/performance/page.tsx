import { redirect } from "next/navigation";

import AdminShell from "@/component/dashboard/AdminShell";
import {
  formatAchievementRate,
  formatPeriodLabel,
  latestClosedMonth,
  PERFORMANCE_DIMENSION_LABELS,
  describeDimensionUnavailability,
} from "@/src/lib/performance-summary-presentation";
import {
  AuthorizationError,
  requirePerformanceDashboardAccess,
} from "@/src/services/authorization.service";
import { resolveCommercialPerformanceTargetPeriod } from "@/src/services/commercial-performance-target.service-core";
import type { PerformanceEvaluationSummary } from "@/src/services/performance-summary.service-core";
import { getEmployeePerformanceSummary } from "@/src/services/performance-summary.service";
import { listUsers } from "@/src/services/user.service";

type PerformancePageSearchParams = Promise<{
  employeeId?: string;
  year?: string;
  month?: string;
}>;

const inputClassName =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100";

const MONTH_LABELS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

/**
 * Ticket 25K — read-only management dashboard (§37/§41: no mutation, no
 * side effect on render). Employee/period selection is a plain GET form
 * (§17), matching this repo's existing filter convention (e.g.
 * FinancialReportPeriodFilter) rather than client-side state.
 */
export default async function PerformanceDashboardPage({
  searchParams,
}: {
  searchParams: PerformancePageSearchParams;
}) {
  let actor: { role: "ADMIN" | "MANAGER" };

  try {
    const authenticated = await requirePerformanceDashboardAccess();
    actor = { role: authenticated.role as "ADMIN" | "MANAGER" };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.code === "UNAUTHENTICATED" ? "/login" : "/admin");
    }
    throw error;
  }

  const params = await searchParams;
  const defaults = latestClosedMonth();
  const year = params.year ? Number(params.year) : defaults.year;
  const month = params.month ? Number(params.month) : defaults.month;
  const employeeId = params.employeeId ?? "";

  const allUsers = await listUsers();
  const employees = allUsers.map((user) => ({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    active: user.active,
  }));

  const period = resolveCommercialPerformanceTargetPeriod({ year, month });
  const result = employeeId
    ? await getEmployeePerformanceSummary(actor, employeeId, period)
    : null;

  return (
    <AdminShell>
      <div>
        <header className="mb-2">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
            Performance
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0f2557] sm:text-4xl md:text-5xl">
            Vue d’ensemble
          </h1>
          <p className="mt-3 max-w-2xl text-slate-500">
            Consultez les quatre dimensions de performance d’un employé pour
            un mois déjà terminé. Ce tableau de bord est en lecture seule —
            créez ou complétez les objectifs et évaluations depuis leurs
            pages dédiées.
          </p>
        </header>

        <form
          method="get"
          className="mt-7 grid gap-4 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-3 md:p-8"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Employé
            </label>
            <select
              name="employeeId"
              defaultValue={employeeId}
              className={inputClassName}
            >
              <option value="">Sélectionnez un employé</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.firstName} {employee.lastName}
                  {employee.active ? "" : " (inactif)"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Mois
            </label>
            <select name="month" defaultValue={month} className={inputClassName}>
              {MONTH_LABELS.map((label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Année
            </label>
            <input
              type="number"
              name="year"
              step={1}
              defaultValue={year}
              className={inputClassName}
            />
          </div>

          <div className="sm:col-span-3">
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-[#0f2557] px-6 text-sm font-semibold text-white transition hover:bg-[#0f2557]/90"
            >
              Afficher
            </button>
          </div>
        </form>

        <div className="mt-6">
          {!employeeId ? (
            <p className="text-sm text-slate-500">
              Sélectionnez un employé pour consulter son évaluation.
            </p>
          ) : result?.status === "EMPLOYEE_NOT_FOUND" ? (
            <p className="text-sm text-red-600">Cet employé est introuvable.</p>
          ) : result?.status === "ACCESS_DENIED" ? (
            <p className="text-sm text-red-600">
              Vous n’avez pas le droit de consulter la performance de cet
              employé.
            </p>
          ) : result?.status === "FOUND" ? (
            <PerformanceSummaryView
              employeeName={`${result.employee.firstName} ${result.employee.lastName}`}
              periodLabel={formatPeriodLabel(year, month)}
              summary={result.summary}
            />
          ) : null}
        </div>
      </div>
    </AdminShell>
  );
}

function PerformanceSummaryView({
  employeeName,
  periodLabel,
  summary,
}: {
  employeeName: string;
  periodLabel: string;
  summary: PerformanceEvaluationSummary;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#0f2557]">{employeeName}</h2>
        <p className="text-sm text-slate-500">{periodLabel}</p>
      </div>

      <div className="rounded-2xl bg-[#0f2557] p-6 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-200">
          Performance globale
        </p>
        {summary.overall ? (
          <p className="mt-2 text-3xl font-bold">
            {summary.overall.score} / {summary.overall.maxScore}
          </p>
        ) : (
          <div className="mt-2">
            <p className="text-xl font-semibold">Non disponible</p>
            <p className="mt-1 text-sm text-blue-200">
              {summary.blockers.length} élément
              {summary.blockers.length > 1 ? "s" : ""} restant
              {summary.blockers.length > 1 ? "s" : ""} à compléter.
            </p>
          </div>
        )}
      </div>

      {summary.machineDerivedSubtotal || summary.humanAssessedSubtotal ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {summary.machineDerivedSubtotal ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Sous-total machine
              </p>
              <p className="mt-1 text-xl font-bold text-[#0f2557]">
                {summary.machineDerivedSubtotal.score} /{" "}
                {summary.machineDerivedSubtotal.maxScore}
              </p>
            </div>
          ) : null}
          {summary.humanAssessedSubtotal ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Sous-total humain
              </p>
              <p className="mt-1 text-xl font-bold text-[#0f2557]">
                {summary.humanAssessedSubtotal.score} /{" "}
                {summary.humanAssessedSubtotal.maxScore}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <DimensionCard
          label={PERFORMANCE_DIMENSION_LABELS.RESULTS}
          maxScore={40}
          content={
            summary.results.status === "SCORED" ? (
              <div>
                <p className="text-2xl font-bold text-[#0f2557]">
                  {summary.results.score} / 40
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {summary.results.creditedWins} résultat
                  {summary.results.creditedWins > 1 ? "s" : ""} gagné
                  {summary.results.creditedWins > 1 ? "s" : ""} — objectif{" "}
                  {summary.results.targetWins}
                </p>
                <p className="text-sm text-slate-500">
                  Taux d’atteinte :{" "}
                  {formatAchievementRate(summary.results.achievementRate)}
                </p>
              </div>
            ) : (
              <UnavailableDimension
                message={describeDimensionUnavailability(
                  "RESULTS",
                  summary.results.status,
                )}
              />
            )
          }
        />

        <DimensionCard
          label={PERFORMANCE_DIMENSION_LABELS.EXECUTION_DISCIPLINE}
          maxScore={30}
          content={
            summary.executionDiscipline.status === "SCORED" ? (
              <div>
                <p className="text-2xl font-bold text-[#0f2557]">
                  {summary.executionDiscipline.score} / 30
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {summary.executionDiscipline.evidence.applicableActions}{" "}
                  actions applicables — {summary.executionDiscipline.evidence.completedOnTime}{" "}
                  à temps, {summary.executionDiscipline.evidence.completedLate}{" "}
                  en retard, {summary.executionDiscipline.evidence.overdueOpen}{" "}
                  toujours en retard
                </p>
                {summary.executionDiscipline.evidence.canceled > 0 ? (
                  <p className="text-sm text-slate-400">
                    {summary.executionDiscipline.evidence.canceled} action
                    {summary.executionDiscipline.evidence.canceled > 1 ? "s" : ""}{" "}
                    annulée
                    {summary.executionDiscipline.evidence.canceled > 1 ? "s" : ""}
                  </p>
                ) : null}
              </div>
            ) : (
              <UnavailableDimension
                message={describeDimensionUnavailability(
                  "EXECUTION_DISCIPLINE",
                  summary.executionDiscipline.status,
                )}
              />
            )
          }
        />

        <DimensionCard
          label={PERFORMANCE_DIMENSION_LABELS.ROLE_RESPONSIBILITIES}
          maxScore={20}
          content={
            summary.roleResponsibilities.status === "SUBMITTED" ? (
              <p className="text-2xl font-bold text-[#0f2557]">
                {summary.roleResponsibilities.score} / 20
              </p>
            ) : (
              <UnavailableDimension
                message={describeDimensionUnavailability(
                  "ROLE_RESPONSIBILITIES",
                  summary.roleResponsibilities.status,
                )}
              />
            )
          }
        />

        <DimensionCard
          label={PERFORMANCE_DIMENSION_LABELS.PROFESSIONAL_CONTRIBUTION}
          maxScore={10}
          content={
            summary.professionalContribution.status === "SUBMITTED" ? (
              <p className="text-2xl font-bold text-[#0f2557]">
                {summary.professionalContribution.score} / 10
              </p>
            ) : (
              <UnavailableDimension
                message={describeDimensionUnavailability(
                  "PROFESSIONAL_CONTRIBUTION",
                  summary.professionalContribution.status,
                )}
              />
            )
          }
        />
      </div>
    </div>
  );
}

function DimensionCard({
  label,
  maxScore,
  content,
}: {
  label: string;
  maxScore: number;
  content: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label} / {maxScore}
      </p>
      <div className="mt-2">{content}</div>
    </div>
  );
}

function UnavailableDimension({ message }: { message: string }) {
  return (
    <div>
      <p className="text-lg font-semibold text-slate-400">Non disponible</p>
      <p className="mt-1 text-sm text-slate-500">{message}</p>
    </div>
  );
}
