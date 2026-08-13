import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";
import type { SalesFunnelAnalyticsFilters } from "@/src/lib/sales-funnel-analytics-filters";
import { resolveSalesFunnelPeriod } from "@/src/lib/sales-funnel-period";
import {
  buildSalesFunnelAnalytics,
  type SalesFunnelAnalytics,
  type SalesFunnelOutcomeRow,
  type SalesFunnelProspectRow,
} from "@/src/services/sales-funnel-analytics.service-core";

/**
 * Ticket 20F's two distinct period meanings, both driven by the same
 * resolved period boundaries: the pipeline cohort is "prospects created
 * during the period" (matching the existing /admin dashboard's date
 * filter convention — Ticket 15H.4's ReportDateFilter), while the
 * movement summary is "follow-ups that occurred during the period".
 * Never conflate Prospect.createdAt with ProspectActivity.occurredAt.
 */
export async function getSalesFunnelAnalytics(
  filters: SalesFunnelAnalyticsFilters,
  referenceDate: Date = new Date(),
): Promise<SalesFunnelAnalytics> {
  const period = resolveSalesFunnelPeriod(filters.period, referenceDate);

  const dateRange =
    period.from && period.toExclusive
      ? { gte: period.from, lt: period.toExclusive }
      : undefined;

  const prospectWhere: Prisma.ProspectWhereInput = {
    ...(filters.product ? { product: filters.product } : {}),
    ...(filters.ownerUserId ? { assignedUserId: filters.ownerUserId } : {}),
    ...(dateRange ? { createdAt: dateRange } : {}),
  };

  const prospectRelationWhere: Prisma.ProspectWhereInput = {
    ...(filters.product ? { product: filters.product } : {}),
    ...(filters.ownerUserId ? { assignedUserId: filters.ownerUserId } : {}),
  };

  const [prospects, outcomeRows] = await Promise.all([
    prisma.prospect.findMany({
      where: prospectWhere,
      select: {
        id: true,
        status: true,
        interest: true,
        product: true,
        assignedUserId: true,
        assignedUser: { select: { firstName: true, lastName: true } },
      },
    }) as Promise<SalesFunnelProspectRow[]>,

    prisma.prospectActivity.findMany({
      where: {
        type: "FOLLOW_UP",
        conversionOutcome: { not: null },
        ...(dateRange ? { occurredAt: dateRange } : {}),
        prospect: prospectRelationWhere,
      },
      select: { conversionOutcome: true },
    }) as Promise<SalesFunnelOutcomeRow[]>,
  ]);

  return buildSalesFunnelAnalytics(period, prospects, outcomeRows);
}
