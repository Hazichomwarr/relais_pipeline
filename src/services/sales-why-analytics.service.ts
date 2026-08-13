import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";
import type { SalesWhyAnalyticsFilters } from "@/src/lib/sales-why-analytics-filters";
import { resolveSalesFunnelPeriod } from "@/src/lib/sales-funnel-period";
import {
  buildSalesWhyAnalytics,
  type SalesWhyAnalytics,
  type SalesWhyOutcomeRow,
} from "@/src/services/sales-why-analytics.service-core";

/**
 * One bounded query for the entire analytical population — no per-reason,
 * per-outcome, per-product, or per-owner query. Period is
 * ProspectActivity.occurredAt (when the follow-up happened), never
 * Prospect.createdAt/updatedAt — same convention as
 * getSalesFunnelAnalytics's outcome query.
 */
export async function getSalesWhyAnalytics(
  filters: SalesWhyAnalyticsFilters,
  referenceDate: Date = new Date(),
): Promise<SalesWhyAnalytics> {
  const period = resolveSalesFunnelPeriod(filters.period, referenceDate);

  const dateRange =
    period.from && period.toExclusive
      ? { gte: period.from, lt: period.toExclusive }
      : undefined;

  const prospectRelationWhere: Prisma.ProspectWhereInput = {
    ...(filters.product ? { product: filters.product } : {}),
    ...(filters.ownerUserId ? { assignedUserId: filters.ownerUserId } : {}),
  };

  const rows = (await prisma.prospectActivity.findMany({
    where: {
      type: "FOLLOW_UP",
      conversionOutcome: filters.outcome ? filters.outcome : { not: null },
      conversionReason: { not: null },
      ...(dateRange ? { occurredAt: dateRange } : {}),
      prospect: prospectRelationWhere,
    },
    select: {
      conversionOutcome: true,
      conversionReason: true,
      conversionReasonNote: true,
      prospect: {
        select: {
          product: true,
          assignedUserId: true,
          assignedUser: { select: { firstName: true, lastName: true } },
        },
      },
    },
  })) as Array<{
    conversionOutcome: SalesWhyOutcomeRow["conversionOutcome"];
    conversionReason: SalesWhyOutcomeRow["conversionReason"];
    conversionReasonNote: string | null;
    prospect: {
      product: SalesWhyOutcomeRow["product"];
      assignedUserId: string | null;
      assignedUser: { firstName: string; lastName: string } | null;
    };
  }>;

  const outcomeRows: SalesWhyOutcomeRow[] = rows.map((row) => ({
    conversionOutcome: row.conversionOutcome,
    conversionReason: row.conversionReason,
    conversionReasonNote: row.conversionReasonNote,
    product: row.prospect.product,
    assignedUserId: row.prospect.assignedUserId,
    assignedUser: row.prospect.assignedUser,
  }));

  return buildSalesWhyAnalytics(period, outcomeRows);
}
