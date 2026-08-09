import { z } from "zod";

import { dailyReportTemplateTypes } from "@/src/lib/validations/daily-report.schema";

/**
 * "today" gets the rich expected-reporter dashboard (KPIs, reporter cards,
 * attention queues); "last7"/"last30" get the plain persisted-report
 * history instead — see the module doc comment above
 * composeDailyReportManagementDashboard in daily-report.service-core.ts
 * for why these two views can't share the same derivation.
 */
export const dailyReportManagementPeriods = ["today", "last7", "last30"] as const;

/**
 * Reused for both the "today" reporter-state filter (all three values
 * valid) and the historical status filter (NOT_STARTED never applies —
 * the page is responsible for not passing it through to a historical
 * query, since persisted reports have no such status).
 */
export const dailyReporterStates = ["SUBMITTED", "DRAFT", "NOT_STARTED"] as const;

/**
 * Every field is independently optional and this never throws — a
 * missing, unrecognized, or stale (copied URL, back button, hand-edited
 * query string) combination silently falls back to "no filter" for that
 * dimension instead of erroring the page (same rule as
 * parseLedgerHistoryFilter in ledger-history-filters.ts).
 */
export const dailyReportManagementFilterSchema = z.object({
  period: z.enum(dailyReportManagementPeriods).optional(),
  employeeId: z.string().trim().min(1).max(100).optional(),
  templateType: z.enum(dailyReportTemplateTypes).optional(),
  state: z.enum(dailyReporterStates).optional(),
});

export type DailyReportManagementFilterParams = z.input<
  typeof dailyReportManagementFilterSchema
>;
export type ValidatedDailyReportManagementFilters = z.output<
  typeof dailyReportManagementFilterSchema
>;

export function parseDailyReportManagementFilters(
  params: DailyReportManagementFilterParams,
): ValidatedDailyReportManagementFilters {
  const parsed = dailyReportManagementFilterSchema.safeParse(params);
  return parsed.success ? parsed.data : {};
}

/** Merges a partial change into the current filters and serializes to the /admin/reports URL — "today" and empty values are omitted since they're the defaults. */
export function buildDailyReportManagementFilterUrl(
  current: ValidatedDailyReportManagementFilters,
  changes: Partial<ValidatedDailyReportManagementFilters>,
): string {
  const next = { ...current, ...changes };
  const params = new URLSearchParams();

  if (next.period && next.period !== "today") {
    params.set("period", next.period);
  }
  if (next.employeeId) {
    params.set("employeeId", next.employeeId);
  }
  if (next.templateType) {
    params.set("templateType", next.templateType);
  }
  if (next.state) {
    params.set("state", next.state);
  }

  const query = params.toString();
  return query ? `/admin/reports?${query}` : "/admin/reports";
}
