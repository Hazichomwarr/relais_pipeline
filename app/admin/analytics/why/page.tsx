import { redirect } from "next/navigation";

import AdminShell from "@/component/dashboard/AdminShell";
import AnalyticsNav from "@/component/analytics/AnalyticsNav";
import OtherExplanations from "@/component/analytics/why/OtherExplanations";
import OutcomeReasonBreakdown from "@/component/analytics/why/OutcomeReasonBreakdown";
import OwnerReasonBreakdown from "@/component/analytics/why/OwnerReasonBreakdown";
import ProductReasonBreakdown from "@/component/analytics/why/ProductReasonBreakdown";
import ReasonOutcomeMatrix from "@/component/analytics/why/ReasonOutcomeMatrix";
import ReasonRanking from "@/component/analytics/why/ReasonRanking";
import WhyAnalyticsEmptyState from "@/component/analytics/why/WhyAnalyticsEmptyState";
import WhyAnalyticsFilters from "@/component/analytics/why/WhyAnalyticsFilters";
import WhyAnalyticsSummary from "@/component/analytics/why/WhyAnalyticsSummary";
import { parseSalesWhyAnalyticsFilters } from "@/src/lib/sales-why-analytics-filters";
import {
  AuthorizationError,
  requireSalesAnalyticsAccess,
} from "@/src/services/authorization.service";
import { getSalesWhyAnalytics } from "@/src/services/sales-why-analytics.service";
import { listUsers } from "@/src/services/user.service";

type WhyAnalyticsSearchParams = Promise<{
  period?: string;
  product?: string;
  owner?: string;
  outcome?: string;
}>;

export default async function WhyAnalyticsPage({
  searchParams,
}: {
  searchParams: WhyAnalyticsSearchParams;
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
  const filters = parseSalesWhyAnalyticsFilters(params);

  const [analytics, owners] = await Promise.all([
    getSalesWhyAnalytics(filters),
    listUsers(),
  ]);

  // A specific Résultat is already the same population as the overall
  // ranking below it — showing the 4-outcome breakdown too would be
  // redundant, so it's omitted rather than rendered mostly empty.
  const showOutcomeBreakdown = !filters.outcome;

  return (
    <AdminShell activeItem="analytics">
      <div className="mx-auto max-w-6xl">
        <AnalyticsNav />

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-[#0f2557] md:text-4xl">
            Pourquoi les opportunités avancent-elles ?
          </h1>
          <p className="mt-2 max-w-2xl text-base text-slate-500">
            Analysez les raisons observées lors des suivis commerciaux.
          </p>
        </div>

        <div className="space-y-6">
          <WhyAnalyticsFilters owners={owners} />

          {analytics.summary.structuredFollowUps === 0 ? (
            <WhyAnalyticsEmptyState />
          ) : (
            <>
              <WhyAnalyticsSummary summary={analytics.summary} />
              <ReasonRanking reasons={analytics.reasons} />
              {showOutcomeBreakdown && (
                <OutcomeReasonBreakdown byOutcome={analytics.byOutcome} />
              )}
              <OtherExplanations explanations={analytics.otherExplanations} />
              <ReasonOutcomeMatrix matrix={analytics.matrix} />
              <ProductReasonBreakdown byProduct={analytics.byProduct} />
              <OwnerReasonBreakdown byOwner={analytics.byOwner} />
            </>
          )}

          <p className="border-t border-slate-100 pt-4 text-xs text-slate-400">
            Les analyses reposent uniquement sur les suivis structurés
            enregistrés depuis l’activation du nouveau workflow commercial.
          </p>
        </div>
      </div>
    </AdminShell>
  );
}
