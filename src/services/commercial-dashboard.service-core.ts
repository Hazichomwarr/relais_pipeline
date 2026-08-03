import type { CommercialIdentity } from "@/src/services/commercial-access.service-core";
import { assertCommercialAccessCore } from "@/src/services/commercial-access.service-core";

export type CommercialDashboardDependencies<
  TKpis,
  TPipeline,
  TFollowUp,
  TProspect,
> = {
  findCommercial: (userId: string) => Promise<CommercialIdentity | null>;
  getPerformance: (
    userId: string,
    today: Date,
  ) => Promise<{ kpis: TKpis; pipeline: TPipeline }>;
  getFollowUps: (userId: string, today: Date) => Promise<TFollowUp[]>;
  getRecentProspects: (userId: string) => Promise<TProspect[]>;
};

export async function getCommercialDashboardCore<
  TKpis,
  TPipeline,
  TFollowUp,
  TProspect,
>(
  userId: string,
  today: Date,
  dependencies: CommercialDashboardDependencies<
    TKpis,
    TPipeline,
    TFollowUp,
    TProspect
  >,
) {
  const commercial = await assertCommercialAccessCore(
    userId,
    dependencies.findCommercial,
  );

  const [performance, todaysFollowUps, recentProspects] = await Promise.all([
    dependencies.getPerformance(commercial.id, today),
    dependencies.getFollowUps(commercial.id, today),
    dependencies.getRecentProspects(commercial.id),
  ]);

  return {
    commercial,
    kpis: performance.kpis,
    todaysFollowUps,
    recentProspects,
    pipeline: performance.pipeline,
  };
}
