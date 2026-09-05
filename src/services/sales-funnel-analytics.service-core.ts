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

/**
 * Ticket 28A.1 — one historical activity row that could settle "who was
 * responsible when this prospect's current WON/LOST outcome was recorded":
 * either a WON_TRANSITION row (carrying frozen sales credit) or a FOLLOW_UP
 * row whose conversionOutcome is LOST (carrying the neutral responsibility
 * snapshot — LOST has no credit concept). Never Prospect.assignedUserId.
 */
export type SalesFunnelHistoricalOutcomeRow = {
  prospectId: string;
  type: "WON_TRANSITION" | "FOLLOW_UP";
  occurredAt: Date;
  creditedUserId: string | null;
  creditedUserNameAtEvent: string | null;
  responsibleUserIdAtEvent: string | null;
  responsibleUserAtEvent: { firstName: string; lastName: string } | null;
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
  /**
   * `total`/`interested`/`qualified`/`proposalSent` describe this owner's
   * CURRENT portfolio within the cohort (sourced from `prospects`, live
   * `assignedUserId`) — correct to change immediately on a future
   * reassignment. `won`/`lost` (Ticket 28A.1) are sourced from frozen
   * event-time attribution instead (`creditedUserId` for WON,
   * `responsibleUserIdAtEvent` for LOST) and do NOT move when a prospect
   * is later reassigned — a commercial with zero current prospects can
   * still show historical won/lost counts here.
   */
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

type HistoricalWonLostBucket = {
  won: number;
  lost: number;
  name: string | null;
};

/**
 * Ticket 28A.1 — reduces every historical WON_TRANSITION/LOST-FOLLOW_UP row
 * to at most one surviving attribution per prospect per outcome type (the
 * latest by occurredAt), then only counts it if the prospect's CURRENT
 * status still matches that outcome. This guards against a prospect that
 * cycled through LOST (or WON) more than once — no enforced status state
 * machine prevents that (Ticket 20A) — being double-counted or counted
 * against a stale event instead of the one that produced its current
 * status. Grouped by the frozen field appropriate to each outcome type:
 * `creditedUserId` for WON (sales credit), `responsibleUserIdAtEvent` for
 * LOST (neutral responsibility — LOST has no credit concept). Never
 * Prospect.assignedUserId.
 */
function buildHistoricalWonLostByOwner(
  historicalOutcomeEvents: SalesFunnelHistoricalOutcomeRow[],
  currentStatusByProspectId: Map<string, ProspectStatus>,
): Map<string, HistoricalWonLostBucket> {
  const latestByProspectAndType = new Map<string, SalesFunnelHistoricalOutcomeRow>();
  for (const event of historicalOutcomeEvents) {
    const key = `${event.prospectId}:${event.type}`;
    const existing = latestByProspectAndType.get(key);
    if (!existing || event.occurredAt > existing.occurredAt) {
      latestByProspectAndType.set(key, event);
    }
  }

  const buckets = new Map<string, HistoricalWonLostBucket>();
  const credit = (key: string, delta: { won?: number; lost?: number }, name: string | null) => {
    const bucket = buckets.get(key) ?? { won: 0, lost: 0, name: null };
    bucket.won += delta.won ?? 0;
    bucket.lost += delta.lost ?? 0;
    bucket.name = bucket.name ?? name;
    buckets.set(key, bucket);
  };

  for (const event of latestByProspectAndType.values()) {
    const currentStatus = currentStatusByProspectId.get(event.prospectId);

    if (event.type === "WON_TRANSITION" && currentStatus === "WON") {
      credit(event.creditedUserId ?? "UNASSIGNED", { won: 1 }, event.creditedUserNameAtEvent);
    } else if (event.type === "FOLLOW_UP" && currentStatus === "LOST") {
      const name = event.responsibleUserAtEvent
        ? `${event.responsibleUserAtEvent.firstName} ${event.responsibleUserAtEvent.lastName}`
        : null;
      credit(event.responsibleUserIdAtEvent ?? "UNASSIGNED", { lost: 1 }, name);
    }
  }

  return buckets;
}

/**
 * All grouping/aggregation happens here, once, from already-fetched rows
 * — the service layer issues exactly three bounded queries (current
 * prospects for the cohort, structured FOLLOW_UP outcomes for the
 * activity period, and — Ticket 28A.1 — historical WON/LOST attribution
 * for the same cohort) and this function does the rest in memory. No
 * database access, no per-product/per-owner query.
 */
export function buildSalesFunnelAnalytics(
  period: ResolvedSalesFunnelPeriod,
  prospects: SalesFunnelProspectRow[],
  outcomeRows: SalesFunnelOutcomeRow[],
  historicalOutcomeEvents: SalesFunnelHistoricalOutcomeRow[] = [],
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

  // Ticket 28A.1 — won/lost no longer come from this cohort's CURRENT
  // status grouped by CURRENT owner (that's exactly the bug: a prospect's
  // historical win/loss must not silently move to whoever owns it today).
  // currentStatusByProspectId lets the historical reducer below confirm
  // each frozen event still matches the prospect's present-day status,
  // guarding against a stale event from a prospect that has since moved on.
  const currentStatusByProspectId = new Map(prospects.map((p) => [p.id, p.status]));
  const historicalWonLostByOwner = buildHistoricalWonLostByOwner(
    historicalOutcomeEvents,
    currentStatusByProspectId,
  );

  // Union of every key that has EITHER a current prospect in this cohort
  // OR a historical won/lost attribution — a commercial who has been
  // fully reassigned away from every prospect they ever closed still
  // needs a row here, or their historical credit would silently vanish
  // from the report the moment their current portfolio hits zero.
  const ownerKeys = new Set([...ownerBuckets.keys(), ...historicalWonLostByOwner.keys()]);

  const byOwner: SalesFunnelOwnerBreakdown[] = [...ownerKeys]
    .map((key) => {
      const rows = ownerBuckets.get(key) ?? [];
      const historical = historicalWonLostByOwner.get(key);
      const ownerName = rows[0]
        ? ownerDisplayName(rows[0])
        : (historical?.name ?? (key === "UNASSIGNED" ? "Non attribué" : "Utilisateur inconnu"));

      return {
        ownerUserId: key === "UNASSIGNED" ? null : key,
        ownerName,
        total: rows.length,
        interested: rows.filter((p) => isInterestedProspect(p.interest)).length,
        qualified: rows.filter((p) => p.status === "QUALIFIED").length,
        proposalSent: rows.filter((p) => p.status === "PROPOSAL_SENT").length,
        won: historical?.won ?? 0,
        lost: historical?.lost ?? 0,
      };
    })
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
