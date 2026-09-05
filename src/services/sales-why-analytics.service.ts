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

  // Ticket 28A.1 — product is filtered through the Prospect relation
  // (product never changes on reassignment), but the owner filter no
  // longer is: it now matches the activity's own frozen
  // responsibleUserIdAtEvent directly, never the prospect's current (and,
  // from Phase 28 on, reassignable) assignedUserId — the whole point of
  // this page is historical attribution, so filtering "by commercial"
  // must mean "who was historically responsible", not "who owns it now".
  const prospectRelationWhere: Prisma.ProspectWhereInput = {
    ...(filters.product ? { product: filters.product } : {}),
  };

  const rows = (await prisma.prospectActivity.findMany({
    where: {
      type: "FOLLOW_UP",
      conversionOutcome: filters.outcome ? filters.outcome : { not: null },
      conversionReason: { not: null },
      ...(dateRange ? { occurredAt: dateRange } : {}),
      ...(filters.ownerUserId
        ? { responsibleUserIdAtEvent: filters.ownerUserId }
        : {}),
      prospect: prospectRelationWhere,
    },
    select: {
      conversionOutcome: true,
      conversionReason: true,
      conversionReasonNote: true,
      responsibleUserIdAtEvent: true,
      responsibleUserAtEvent: { select: { firstName: true, lastName: true } },
      prospect: {
        select: {
          product: true,
        },
      },
    },
  })) as Array<{
    conversionOutcome: SalesWhyOutcomeRow["conversionOutcome"];
    conversionReason: SalesWhyOutcomeRow["conversionReason"];
    conversionReasonNote: string | null;
    responsibleUserIdAtEvent: string | null;
    responsibleUserAtEvent: { firstName: string; lastName: string } | null;
    prospect: {
      product: SalesWhyOutcomeRow["product"];
    };
  }>;

  const outcomeRows: SalesWhyOutcomeRow[] = rows.map((row) => ({
    conversionOutcome: row.conversionOutcome,
    conversionReason: row.conversionReason,
    conversionReasonNote: row.conversionReasonNote,
    product: row.prospect.product,
    responsibleUserIdAtEvent: row.responsibleUserIdAtEvent,
    responsibleUserAtEvent: row.responsibleUserAtEvent,
  }));

  return buildSalesWhyAnalytics(period, outcomeRows);
}
