import "server-only";

import { resolveFinancialReportPeriod } from "@/src/lib/financial-report-period";
import type { FinancialReportFilter } from "@/src/lib/validations/financial-report-filter.schema";
import { computeFinancialReportCore } from "@/src/services/financial-report.service-core";
import {
  getFinancialLedgerSummary,
  listLedgerEntries,
} from "@/src/services/financial-ledger.service";

/**
 * Query strategy: exactly two bounded, date-range-scoped DB reads — the
 * current period's full entry rows (reused for every breakdown below,
 * via the pure aggregators in financial-report.service-core.ts) and the
 * previous period's lightweight {type,status,amount} summary (17A's
 * listForSummary path). No per-product/per-category/per-day queries.
 */
export async function getFinancialReport(
  filter: FinancialReportFilter,
  referenceDate: Date = new Date(),
) {
  const period = resolveFinancialReportPeriod(filter, referenceDate);
  const dateTo = new Date(period.toExclusive.getTime() - 1);
  const previousDateTo = new Date(period.previousToExclusive.getTime() - 1);

  const [entries, previousSummary] = await Promise.all([
    listLedgerEntries({ dateFrom: period.from, dateTo }),
    getFinancialLedgerSummary({
      dateFrom: period.previousFrom,
      dateTo: previousDateTo,
    }),
  ]);

  return computeFinancialReportCore({
    period: {
      from: period.fromDateLabel,
      to: period.toDateLabel,
      label: period.label,
    },
    entries,
    previousSummary,
  });
}

export type { FinancialReport } from "@/src/services/financial-report.service-core";
