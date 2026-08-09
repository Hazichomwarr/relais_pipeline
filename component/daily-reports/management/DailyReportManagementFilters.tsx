"use client";

import type { DailyReportTemplateType } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { dailyReportTemplateTypeOptions } from "@/src/lib/constants/daily-report-options";
import {
  buildDailyReportManagementFilterUrl,
  type ValidatedDailyReportManagementFilters,
} from "@/src/lib/validations/daily-report-management-filters.schema";
import type { DailyReporterState } from "@/src/services/daily-report.service-core";

type EmployeeOption = { id: string; firstName: string; lastName: string };

type DailyReportManagementFiltersProps = {
  filters: ValidatedDailyReportManagementFilters;
  employees: EmployeeOption[];
};

const selectClassName =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100";

/**
 * "Non commencé" only makes sense for today's expected-reporter view — a
 * historical persisted-report list has no such status (Ticket 19C).
 */
export default function DailyReportManagementFilters({
  filters,
  employees,
}: DailyReportManagementFiltersProps) {
  const router = useRouter();
  const period = filters.period ?? "today";

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Filtrer par période" className="flex flex-wrap gap-2">
        <FilterTab
          href={buildDailyReportManagementFilterUrl(filters, { period: "today" })}
          label="Aujourd’hui"
          active={period === "today"}
        />
        <FilterTab
          href={buildDailyReportManagementFilterUrl(filters, { period: "last7" })}
          label="7 derniers jours"
          active={period === "last7"}
        />
        <FilterTab
          href={buildDailyReportManagementFilterUrl(filters, { period: "last30" })}
          label="30 derniers jours"
          active={period === "last30"}
        />
      </nav>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Employé</span>
          <select
            value={filters.employeeId ?? ""}
            onChange={(event) =>
              router.push(
                buildDailyReportManagementFilterUrl(filters, {
                  employeeId: event.target.value || undefined,
                }),
              )
            }
            className={selectClassName}
          >
            <option value="">Tous les employés</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.firstName} {employee.lastName}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Modèle</span>
          <select
            value={filters.templateType ?? ""}
            onChange={(event) =>
              router.push(
                buildDailyReportManagementFilterUrl(filters, {
                  templateType: (event.target.value || undefined) as
                    | DailyReportTemplateType
                    | undefined,
                }),
              )
            }
            className={selectClassName}
          >
            <option value="">Tous les modèles</option>
            {dailyReportTemplateTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Statut</span>
          <select
            value={filters.state ?? ""}
            onChange={(event) =>
              router.push(
                buildDailyReportManagementFilterUrl(filters, {
                  state: (event.target.value || undefined) as DailyReporterState | undefined,
                }),
              )
            }
            className={selectClassName}
          >
            <option value="">Tous</option>
            <option value="SUBMITTED">Envoyé</option>
            <option value="DRAFT">Brouillon</option>
            {period === "today" && <option value="NOT_STARTED">Non commencé</option>}
          </select>
        </label>
      </div>
    </div>
  );
}

function FilterTab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
        active ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {label}
    </Link>
  );
}
