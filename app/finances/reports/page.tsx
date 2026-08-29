import { ArrowLeft, Wallet } from "lucide-react";
import Link from "next/link";

import DailyFinancialMovement from "@/component/finances/reports/DailyFinancialMovement";
import ExpenseCategoryBreakdown from "@/component/finances/reports/ExpenseCategoryBreakdown";
import FinancialReportPeriodFilter from "@/component/finances/reports/FinancialReportPeriodFilter";
import FinancialReportSummaryCards from "@/component/finances/reports/FinancialReportSummaryCards";
import PaymentMethodBreakdown from "@/component/finances/reports/PaymentMethodBreakdown";
import ProductRevenueBreakdown from "@/component/finances/reports/ProductRevenueBreakdown";
import { resolveFinancialReportPeriod } from "@/src/lib/financial-report-period";
import { parseFinancialReportFilter } from "@/src/lib/validations/financial-report-filter.schema";
import { getFinancialReport } from "@/src/services/financial-report.service";

type FinancialReportsSearchParams = Promise<{
  period?: string;
  from?: string;
  to?: string;
}>;

/**
 * Ticket 25N: the layout already ran requireFinanceAccess() (ADMIN or
 * ASSISTANT) before any children render, so no financial data is
 * fetched pre-authorization.
 */
export default async function FinancialReportsPage({
  searchParams,
}: {
  searchParams: FinancialReportsSearchParams;
}) {
  const params = await searchParams;
  const requestedPeriod =
    params.period === "today" ||
    params.period === "week" ||
    params.period === "month" ||
    params.period === "year" ||
    params.period === "custom"
      ? params.period
      : "month";

  const filter = parseFinancialReportFilter(params);
  const report = await getFinancialReport(filter);

  // Used only to prefill the custom date inputs — the report data itself
  // always comes from `filter`, the fallback-safe parsed value.
  const resolvedForDisplay = resolveFinancialReportPeriod(filter);

  const isPeriodEmpty =
    report.summary.inflows === "0.00" &&
    report.summary.outflows === "0.00" &&
    report.summary.entryCount === 0;

  return (
    <div>
      <Link
        href="/finances"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux finances
      </Link>

      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#0f2557] md:text-4xl">
            Rapports financiers
          </h1>
          <p className="mt-2 max-w-xl text-base text-slate-500">
            Analysez les entrées, les sorties et les sources de revenus sur
            une période donnée.
          </p>
        </div>

        <Link
          href="/finances"
          className="flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <Wallet className="h-4 w-4" />
          Voir la caisse
        </Link>
      </div>

      <FinancialReportPeriodFilter
        requestedPeriod={requestedPeriod}
        fromDateLabel={resolvedForDisplay.fromDateLabel}
        toDateLabel={resolvedForDisplay.toDateLabel}
      />

      <p className="mt-4 text-sm font-medium text-slate-500">
        {report.period.label}
      </p>

      {isPeriodEmpty ? (
        <div className="mt-6 rounded-4xl border border-slate-200 bg-white px-6 py-16 text-center">
          <h2 className="text-2xl font-bold text-[#0f2557]">
            Aucun mouvement financier sur cette période.
          </h2>
        </div>
      ) : (
        <>
          <div className="mt-6">
            <FinancialReportSummaryCards
              summary={report.summary}
              comparison={report.comparison}
            />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ProductRevenueBreakdown productRevenue={report.productRevenue} />
            <ExpenseCategoryBreakdown
              expenseCategories={report.expenseCategories}
            />
            <PaymentMethodBreakdown paymentMethods={report.paymentMethods} />
            <DailyFinancialMovement dailyMovement={report.dailyMovement} />
          </div>
        </>
      )}
    </div>
  );
}
