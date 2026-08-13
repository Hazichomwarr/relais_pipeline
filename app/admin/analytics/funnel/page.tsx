import { redirect } from "next/navigation";

import AdminShell from "@/component/dashboard/AdminShell";
import CommercialOutcomeSummary from "@/component/analytics/funnel/CommercialOutcomeSummary";
import CurrentPipelineDistribution from "@/component/analytics/funnel/CurrentPipelineDistribution";
import FunnelAnalyticsEmptyState from "@/component/analytics/funnel/FunnelAnalyticsEmptyState";
import FunnelAnalyticsFilters from "@/component/analytics/funnel/FunnelAnalyticsFilters";
import FunnelSummaryCards from "@/component/analytics/funnel/FunnelSummaryCards";
import OwnerPipelineBreakdown from "@/component/analytics/funnel/OwnerPipelineBreakdown";
import ProductPipelineBreakdown from "@/component/analytics/funnel/ProductPipelineBreakdown";
import { parseSalesFunnelAnalyticsFilters } from "@/src/lib/sales-funnel-analytics-filters";
import {
  AuthorizationError,
  requireSalesAnalyticsAccess,
} from "@/src/services/authorization.service";
import { getSalesFunnelAnalytics } from "@/src/services/sales-funnel-analytics.service";
import { listUsers } from "@/src/services/user.service";

type FunnelAnalyticsSearchParams = Promise<{
  period?: string;
  product?: string;
  owner?: string;
}>;

export default async function FunnelAnalyticsPage({
  searchParams,
}: {
  searchParams: FunnelAnalyticsSearchParams;
}) {
  try {
    await requireSalesAnalyticsAccess();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.code === "UNAUTHENTICATED" ? "/login" : "/admin");
    }
    throw error;
  }

  const params = await searchParams;
  const filters = parseSalesFunnelAnalyticsFilters(params);

  const [analytics, owners] = await Promise.all([
    getSalesFunnelAnalytics(filters),
    listUsers(),
  ]);

  return (
    <AdminShell activeItem="analytics">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-[#0f2557] md:text-4xl">
            Analyse du pipeline
          </h1>
          <p className="mt-2 max-w-2xl text-base text-slate-500">
            Comprenez où se trouvent les opportunités commerciales et comment
            elles évoluent.
          </p>
        </div>

        <div className="space-y-6">
          <FunnelAnalyticsFilters owners={owners} />

          {analytics.summary.totalProspects === 0 ? (
            <FunnelAnalyticsEmptyState />
          ) : (
            <>
              <FunnelSummaryCards summary={analytics.summary} />
              <CurrentPipelineDistribution pipeline={analytics.currentPipeline} />
              <ProductPipelineBreakdown byProduct={analytics.byProduct} />
              <OwnerPipelineBreakdown byOwner={analytics.byOwner} />
            </>
          )}

          <CommercialOutcomeSummary outcomes={analytics.outcomes} />
        </div>
      </div>
    </AdminShell>
  );
}
