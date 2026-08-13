import type {
  InterestLevel,
  ProspectConversionOutcome,
  ProspectStatus,
  RelaisProduct,
} from "@prisma/client";

import {
  buildPipeline,
  conversionRate,
  type PipelineItem,
} from "@/src/lib/commercial-dashboard-presentation";
import { relaisProducts } from "@/src/lib/validations/prospect.schema";
import type { ResolvedSalesFunnelPeriod } from "@/src/lib/sales-funnel-period";
import { isInterestedProspect } from "@/src/services/prospect-status.service-core";

export type SalesFunnelProspectRow = {
  id: string;
  status: ProspectStatus;
  interest: InterestLevel;
  product: RelaisProduct;
  assignedUserId: string | null;
  assignedUser: { firstName: string; lastName: string } | null;
};

export type SalesFunnelOutcomeRow = {
  conversionOutcome: ProspectConversionOutcome;
};

export type SalesFunnelSummary = {
  totalProspects: number;
  interestedProspects: number;
  wonProspects: number;
  lostProspects: number;
  /**
   * WON / totalProspects — the "Taux de conversion" headline metric.
   * Always computable, unlike closedWinRate, so this is the preferred V1
   * default (Ticket 20F: "prefer a clearly documented denominator").
   */
  conversionRate: number | null;
  /**
   * WON / (WON + LOST) — "Taux de gain sur opportunités clôturées".
   * A DIFFERENT denominator from conversionRate above; never conflate
   * the two, and never let one silently substitute for the other.
   */
  closedWinRate: number | null;
};

export type SalesFunnelProductBreakdown = {
  product: RelaisProduct;
  total: number;
  won: number;
  lost: number;
  statusCounts: PipelineItem[];
};

export type SalesFunnelOwnerBreakdown = {
  ownerUserId: string | null;
  ownerName: string;
  total: number;
  interested: number;
  qualified: number;
  proposalSent: number;
  won: number;
  lost: number;
};

export type SalesFunnelOutcomeSummary = {
  advanced: number;
  stalled: number;
  won: number;
  lost: number;
  structuredFollowUps: number;
};

export type SalesFunnelAnalytics = {
  period: ResolvedSalesFunnelPeriod;
  summary: SalesFunnelSummary;
  currentPipeline: PipelineItem[];
  outcomes: SalesFunnelOutcomeSummary;
  byProduct: SalesFunnelProductBreakdown[];
  byOwner: SalesFunnelOwnerBreakdown[];
};

function countByStatus(
  prospects: SalesFunnelProspectRow[],
): Partial<Record<ProspectStatus, number>> {
  const counts: Partial<Record<ProspectStatus, number>> = {};
  for (const prospect of prospects) {
    counts[prospect.status] = (counts[prospect.status] ?? 0) + 1;
  }
  return counts;
}

/** WON / total — null (not 0) when there is nothing to divide by, so the UI can render "—" instead of a misleading 0%. */
function resolveGlobalConversionRate(won: number, total: number): number | null {
  return total === 0 ? null : (won / total) * 100;
}

function ownerGroupKey(prospect: SalesFunnelProspectRow): string {
  return prospect.assignedUserId ?? "UNASSIGNED";
}

function ownerDisplayName(prospect: SalesFunnelProspectRow): string {
  if (!prospect.assignedUserId) {
    return "Non attribué";
  }
  return prospect.assignedUser
    ? `${prospect.assignedUser.firstName} ${prospect.assignedUser.lastName}`
    : "Utilisateur inconnu";
}

/**
 * All grouping/aggregation happens here, once, from already-fetched rows
 * — the service layer issues exactly two bounded queries (current
 * prospects for the cohort, structured FOLLOW_UP outcomes for the
 * activity period) and this function does the rest in memory. No
 * database access, no per-product/per-owner query.
 */
export function buildSalesFunnelAnalytics(
  period: ResolvedSalesFunnelPeriod,
  prospects: SalesFunnelProspectRow[],
  outcomeRows: SalesFunnelOutcomeRow[],
): SalesFunnelAnalytics {
  const totalProspects = prospects.length;
  const interestedProspects = prospects.filter((p) =>
    isInterestedProspect(p.interest),
  ).length;
  const wonProspects = prospects.filter((p) => p.status === "WON").length;
  const lostProspects = prospects.filter((p) => p.status === "LOST").length;

  const currentPipeline = buildPipeline(countByStatus(prospects));

  const outcomes: SalesFunnelOutcomeSummary = {
    advanced: 0,
    stalled: 0,
    won: 0,
    lost: 0,
    structuredFollowUps: outcomeRows.length,
  };
  for (const row of outcomeRows) {
    if (row.conversionOutcome === "ADVANCED") outcomes.advanced += 1;
    else if (row.conversionOutcome === "STALLED") outcomes.stalled += 1;
    else if (row.conversionOutcome === "WON") outcomes.won += 1;
    else if (row.conversionOutcome === "LOST") outcomes.lost += 1;
  }

  // Enumerate every current RelaisProduct, even at zero — a future fifth
  // product contributes automatically, with no funnel-domain code change.
  const byProduct: SalesFunnelProductBreakdown[] = relaisProducts.map((product) => {
    const productProspects = prospects.filter((p) => p.product === product);
    return {
      product,
      total: productProspects.length,
      won: productProspects.filter((p) => p.status === "WON").length,
      lost: productProspects.filter((p) => p.status === "LOST").length,
      statusCounts: buildPipeline(countByStatus(productProspects)),
    };
  });

  const ownerBuckets = new Map<string, SalesFunnelProspectRow[]>();
  for (const prospect of prospects) {
    const key = ownerGroupKey(prospect);
    const bucket = ownerBuckets.get(key);
    if (bucket) {
      bucket.push(prospect);
    } else {
      ownerBuckets.set(key, [prospect]);
    }
  }

  const byOwner: SalesFunnelOwnerBreakdown[] = [...ownerBuckets.entries()]
    .map(([key, rows]) => ({
      ownerUserId: key === "UNASSIGNED" ? null : key,
      ownerName: ownerDisplayName(rows[0]),
      total: rows.length,
      interested: rows.filter((p) => isInterestedProspect(p.interest)).length,
      qualified: rows.filter((p) => p.status === "QUALIFIED").length,
      proposalSent: rows.filter((p) => p.status === "PROPOSAL_SENT").length,
      won: rows.filter((p) => p.status === "WON").length,
      lost: rows.filter((p) => p.status === "LOST").length,
    }))
    // Alphabetical, not by volume — Ticket 20F: "do not compute
    // performance rankings", so the default order must not read as one.
    .sort((a, b) => a.ownerName.localeCompare(b.ownerName, "fr"));

  return {
    period,
    summary: {
      totalProspects,
      interestedProspects,
      wonProspects,
      lostProspects,
      conversionRate: resolveGlobalConversionRate(wonProspects, totalProspects),
      closedWinRate: conversionRate(wonProspects, lostProspects),
    },
    currentPipeline,
    outcomes,
    byProduct,
    byOwner,
  };
}
