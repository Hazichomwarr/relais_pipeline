import type { ProspectStatus } from "@prisma/client";

import {
  buildPipeline,
  conversionRate,
} from "@/src/lib/commercial-dashboard-presentation";

export type CommercialPerformanceSource = {
  statusCounts: Array<{ status: ProspectStatus; count: number }>;
  followUpsToday: number;
  overdueProspects: number;
  readyToDiscuss: number;
};

export function presentCommercialPerformance(
  source: CommercialPerformanceSource,
) {
  const counts = Object.fromEntries(
    source.statusCounts.map((item) => [item.status, item.count]),
  ) as Partial<Record<ProspectStatus, number>>;
  const pipeline = buildPipeline(counts);
  const countFor = (status: ProspectStatus) => counts[status] ?? 0;
  const totalAssignedProspects = pipeline.reduce(
    (sum, item) => sum + item.count,
    0,
  );
  const wonProspects = countFor("WON");
  const lostProspects = countFor("LOST");

  return {
    kpis: {
      totalAssignedProspects,
      followUpsToday: source.followUpsToday,
      overdueProspects: source.overdueProspects,
      qualifiedProspects: countFor("QUALIFIED"),
      wonProspects,
      lostProspects,
      readyToDiscuss: source.readyToDiscuss,
      conversionRate: conversionRate(wonProspects, lostProspects),
    },
    pipeline,
  };
}
