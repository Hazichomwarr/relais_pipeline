import { redirect } from "next/navigation";

import CommercialFollowUpPriority from "@/component/commercial/CommercialFollowUpPriority";
import CommercialHeader from "@/component/commercial/CommercialHeader";
import CommercialKpiCards from "@/component/commercial/CommercialKpiCards";
import CommercialPipeline from "@/component/commercial/CommercialPipeline";
import CommercialProspectList from "@/component/commercial/CommercialProspectList";
import CommercialRecentProspects from "@/component/commercial/CommercialRecentProspects";
import { buildReturnToPath } from "@/src/lib/return-to";
import { CommercialAccessError } from "@/src/services/commercial-access.service-core";
import { getCommercialDashboard } from "@/src/services/commercial-dashboard.service";
import { getCommercialProspects } from "@/src/services/commercial-prospect.service";
import { requireCommercial } from "@/src/services/authorization.service";
import type {
  InterestLevel,
  ProspectStatus,
  RelaisProduct,
} from "@prisma/client";

type CommercialDashboardSearchParams = Promise<{
  search?: string;
  product?: string;
  interest?: string;
  status?: string;
  date?: string;
}>;

export default async function CommercialDashboardPage({
  searchParams,
}: {
  searchParams: CommercialDashboardSearchParams;
}) {
  const user = await requireCommercial();
  const params = await searchParams;

  const filters = {
    search: params.search,
    product: params.product as RelaisProduct | undefined,
    interest: params.interest as InterestLevel | undefined,
    status: params.status as ProspectStatus | undefined,
    date: params.date,
  };

  const hasActiveFilters = Object.values(filters).some(
    (value) => value !== undefined && value !== "",
  );

  let dashboard;
  let prospects;

  try {
    [dashboard, prospects] = await Promise.all([
      getCommercialDashboard(user.id),
      getCommercialProspects(user.id, filters),
    ]);
  } catch (error) {
    if (error instanceof CommercialAccessError) {
      redirect("/login");
    }
    throw error;
  }

  const returnTo = buildReturnToPath("/dashboard/commercial", params);

  return (
    <div className="flex flex-col gap-6">
      <CommercialHeader firstName={dashboard.commercial.firstName} />

      <CommercialKpiCards kpis={dashboard.kpis} />

      <CommercialPipeline pipeline={dashboard.pipeline} />

      <CommercialFollowUpPriority
        items={dashboard.todaysFollowUps}
        returnTo={returnTo}
      />

      <CommercialRecentProspects
        prospects={dashboard.recentProspects}
        returnTo={returnTo}
      />

      <CommercialProspectList
        prospects={prospects}
        hasActiveFilters={hasActiveFilters}
        returnTo={returnTo}
      />
    </div>
  );
}
