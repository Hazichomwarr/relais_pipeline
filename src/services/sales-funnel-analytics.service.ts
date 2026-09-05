import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";
import type { SalesFunnelAnalyticsFilters } from "@/src/lib/sales-funnel-analytics-filters";
import { resolveSalesFunnelPeriod } from "@/src/lib/sales-funnel-period";
import {
  buildSalesFunnelAnalytics,
  type SalesFunnelAnalytics,
  type SalesFunnelHistoricalOutcomeRow,
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

  // Ticket 28A.1 — deliberately excludes ownerUserId: this is the cohort
  // shared by the live pipeline query and the new historical-attribution
  // query below, and only the former should ever filter by CURRENT
  // Prospect.assignedUserId.
  const prospectCohortWhere: Prisma.ProspectWhereInput = {
    ...(filters.product ? { product: filters.product } : {}),
    ...(dateRange ? { createdAt: dateRange } : {}),
  };

  const prospectWhere: Prisma.ProspectWhereInput = {
    ...prospectCohortWhere,
    ...(filters.ownerUserId ? { assignedUserId: filters.ownerUserId } : {}),
  };

  const prospectProductWhere: Prisma.ProspectWhereInput = {
    ...(filters.product ? { product: filters.product } : {}),
  };

  const [prospects, outcomeRows, historicalOutcomeEvents] = await Promise.all([
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

    // Ticket 28A.1 — the owner filter here now matches this activity's own
    // frozen responsibleUserIdAtEvent directly (set on every FOLLOW_UP row,
    // including WON ones), never the prospect's current assignedUserId via
    // the relation — this is a historical-events query, so "by commercial"
    // must mean who was responsible when each row was recorded.
    prisma.prospectActivity.findMany({
      where: {
        type: "FOLLOW_UP",
        conversionOutcome: { not: null },
        ...(dateRange ? { occurredAt: dateRange } : {}),
        ...(filters.ownerUserId
          ? { responsibleUserIdAtEvent: filters.ownerUserId }
          : {}),
        prospect: prospectProductWhere,
      },
      select: { conversionOutcome: true },
    }) as Promise<SalesFunnelOutcomeRow[]>,

    // Ticket 28A.1 — historical WON/LOST attribution for the byOwner
    // breakdown, scoped to the SAME cohort as `prospects` (prospect
    // created within the period), never filtered by current
    // Prospect.assignedUserId: WON rows filter/attribute through the
    // authoritative creditedUserId (sales credit); LOST rows through the
    // neutral responsibleUserIdAtEvent (LOST has no credit concept). A
    // prospect reassigned away from its historical closer still surfaces
    // under that closer here, and under that closer alone when filtered.
    prisma.prospectActivity.findMany({
      where: {
        OR: [
          {
            type: "WON_TRANSITION",
            ...(filters.ownerUserId
              ? { creditedUserId: filters.ownerUserId }
              : {}),
          },
          {
            type: "FOLLOW_UP",
            conversionOutcome: "LOST",
            ...(filters.ownerUserId
              ? { responsibleUserIdAtEvent: filters.ownerUserId }
              : {}),
          },
        ],
        prospect: prospectCohortWhere,
      },
      select: {
        prospectId: true,
        type: true,
        occurredAt: true,
        creditedUserId: true,
        creditedUserNameAtEvent: true,
        responsibleUserIdAtEvent: true,
        responsibleUserAtEvent: { select: { firstName: true, lastName: true } },
      },
      orderBy: { occurredAt: "desc" },
    }) as Promise<SalesFunnelHistoricalOutcomeRow[]>,
  ]);

  return buildSalesFunnelAnalytics(period, prospects, outcomeRows, historicalOutcomeEvents);
}
