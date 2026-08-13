import type {
  ProspectConversionOutcome,
  ProspectConversionReason,
  RelaisProduct,
} from "@prisma/client";

import { relaisProducts } from "@/src/lib/validations/prospect.schema";
import type { ResolvedSalesFunnelPeriod } from "@/src/lib/sales-funnel-period";
import { isConversionReasonAllowedForOutcome } from "@/src/services/prospect-conversion.service-core";

const conversionOutcomes: readonly ProspectConversionOutcome[] = [
  "ADVANCED",
  "STALLED",
  "WON",
  "LOST",
];

/** How many products/owners a breakdown card shows before "see full ranking" — matches the ticket's 3-item examples. */
const TOP_REASONS_LIMIT = 3;

export type SalesWhyOutcomeRow = {
  conversionOutcome: ProspectConversionOutcome;
  conversionReason: ProspectConversionReason;
  conversionReasonNote: string | null;
  product: RelaisProduct;
  assignedUserId: string | null;
  assignedUser: { firstName: string; lastName: string } | null;
};

export type SalesWhyAnalyticsSummary = {
  structuredFollowUps: number;
  advanced: number;
  stalled: number;
  won: number;
  lost: number;
};

export type ReasonOutcomeCounts = {
  advanced: number;
  stalled: number;
  won: number;
  lost: number;
};

export type SalesWhyReasonEntry = {
  reason: ProspectConversionReason;
  count: number;
  percentage: number;
  byOutcome: ReasonOutcomeCounts;
};

export type SalesWhyReasonCount = {
  reason: ProspectConversionReason;
  count: number;
  percentage: number;
};

export type SalesWhyTopReason = {
  reason: ProspectConversionReason;
  count: number;
};

export type SalesWhyOutcomeEntry = {
  outcome: ProspectConversionOutcome;
  total: number;
  reasons: SalesWhyReasonCount[];
};

export type SalesWhyProductEntry = {
  product: RelaisProduct;
  total: number;
  topReasons: SalesWhyTopReason[];
};

export type SalesWhyOwnerEntry = {
  ownerUserId: string | null;
  ownerName: string;
  total: number;
  topReasons: SalesWhyTopReason[];
};

export type SalesWhyMatrixRow = ReasonOutcomeCounts & {
  reason: ProspectConversionReason;
  total: number;
};

export type SalesWhyAnalytics = {
  period: ResolvedSalesFunnelPeriod;
  summary: SalesWhyAnalyticsSummary;
  reasons: SalesWhyReasonEntry[];
  byOutcome: SalesWhyOutcomeEntry[];
  byProduct: SalesWhyProductEntry[];
  byOwner: SalesWhyOwnerEntry[];
  matrix: SalesWhyMatrixRow[];
  otherExplanations: string[];
};

/** 0 (never NaN/Infinity) when there is nothing to divide by. */
function safePercentage(count: number, denominator: number): number {
  return denominator === 0 ? 0 : (count / denominator) * 100;
}

function sortByCountThenReason<T extends { reason: ProspectConversionReason; count: number }>(
  entries: T[],
): T[] {
  return [...entries].sort(
    (a, b) => b.count - a.count || a.reason.localeCompare(b.reason),
  );
}

function countByReason(
  rows: SalesWhyOutcomeRow[],
): Map<ProspectConversionReason, number> {
  const counts = new Map<ProspectConversionReason, number>();
  for (const row of rows) {
    counts.set(row.conversionReason, (counts.get(row.conversionReason) ?? 0) + 1);
  }
  return counts;
}

function buildReasonCounts(
  rows: SalesWhyOutcomeRow[],
  denominator: number,
): SalesWhyReasonCount[] {
  const entries = [...countByReason(rows).entries()].map(([reason, count]) => ({
    reason,
    count,
    percentage: safePercentage(count, denominator),
  }));
  return sortByCountThenReason(entries);
}

function topReasonCounts(rows: SalesWhyOutcomeRow[]): SalesWhyTopReason[] {
  const entries = [...countByReason(rows).entries()].map(([reason, count]) => ({
    reason,
    count,
  }));
  return sortByCountThenReason(entries).slice(0, TOP_REASONS_LIMIT);
}

/**
 * Overall reason ranking, each entry carrying its own outcome breakdown —
 * this is also the source `buildSalesWhyAnalytics` derives the reason ×
 * outcome matrix from, so the two never drift apart.
 */
function buildReasonRanking(
  rows: SalesWhyOutcomeRow[],
  denominator: number,
): SalesWhyReasonEntry[] {
  const entries = [...countByReason(rows).entries()].map(([reason, count]) => {
    const reasonRows = rows.filter((row) => row.conversionReason === reason);
    return {
      reason,
      count,
      percentage: safePercentage(count, denominator),
      byOutcome: {
        advanced: reasonRows.filter((row) => row.conversionOutcome === "ADVANCED").length,
        stalled: reasonRows.filter((row) => row.conversionOutcome === "STALLED").length,
        won: reasonRows.filter((row) => row.conversionOutcome === "WON").length,
        lost: reasonRows.filter((row) => row.conversionOutcome === "LOST").length,
      },
    };
  });
  return sortByCountThenReason(entries);
}

function ownerDisplayName(row: SalesWhyOutcomeRow): string {
  if (!row.assignedUserId) {
    return "Non attribué";
  }
  return row.assignedUser
    ? `${row.assignedUser.firstName} ${row.assignedUser.lastName}`
    : "Utilisateur inconnu";
}

/**
 * All grouping/aggregation happens here, once, from a single already-fetched
 * row set — mirrors buildSalesFunnelAnalytics's "no database access here"
 * convention. Rows failing `isConversionReasonAllowedForOutcome` (a
 * corrupted historical outcome/reason pair) are excluded rather than
 * reinterpreted — see Ticket 20G's "Data Corruption Defense".
 */
export function buildSalesWhyAnalytics(
  period: ResolvedSalesFunnelPeriod,
  rows: SalesWhyOutcomeRow[],
): SalesWhyAnalytics {
  const validRows = rows.filter((row) =>
    isConversionReasonAllowedForOutcome(row.conversionOutcome, row.conversionReason),
  );

  const structuredFollowUps = validRows.length;

  const summary: SalesWhyAnalyticsSummary = {
    structuredFollowUps,
    advanced: validRows.filter((row) => row.conversionOutcome === "ADVANCED").length,
    stalled: validRows.filter((row) => row.conversionOutcome === "STALLED").length,
    won: validRows.filter((row) => row.conversionOutcome === "WON").length,
    lost: validRows.filter((row) => row.conversionOutcome === "LOST").length,
  };

  const reasons = buildReasonRanking(validRows, structuredFollowUps);

  // All 4 outcomes enumerated unconditionally (like buildSalesFunnelAnalytics
  // enumerates every RelaisProduct) — sparse outcomes like WON/LOST render
  // with an empty `reasons` array rather than disappearing from the DTO.
  const byOutcome: SalesWhyOutcomeEntry[] = conversionOutcomes.map((outcome) => {
    const outcomeRows = validRows.filter((row) => row.conversionOutcome === outcome);
    return {
      outcome,
      total: outcomeRows.length,
      reasons: buildReasonCounts(outcomeRows, outcomeRows.length),
    };
  });

  const byProduct: SalesWhyProductEntry[] = relaisProducts
    .map((product) => {
      const productRows = validRows.filter((row) => row.product === product);
      return {
        product,
        total: productRows.length,
        topReasons: topReasonCounts(productRows),
      };
    })
    .filter((entry) => entry.total > 0);

  const ownerBuckets = new Map<string, SalesWhyOutcomeRow[]>();
  for (const row of validRows) {
    const key = row.assignedUserId ?? "UNASSIGNED";
    const bucket = ownerBuckets.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      ownerBuckets.set(key, [row]);
    }
  }

  const byOwner: SalesWhyOwnerEntry[] = [...ownerBuckets.entries()]
    .map(([key, bucketRows]) => ({
      ownerUserId: key === "UNASSIGNED" ? null : key,
      ownerName: ownerDisplayName(bucketRows[0]),
      total: bucketRows.length,
      topReasons: topReasonCounts(bucketRows),
    }))
    // Alphabetical, not by volume — same no-leaderboard convention as
    // buildSalesFunnelAnalytics's byOwner.
    .sort((a, b) => a.ownerName.localeCompare(b.ownerName, "fr"));

  const matrix: SalesWhyMatrixRow[] = reasons.map((entry) => ({
    reason: entry.reason,
    total: entry.count,
    ...entry.byOutcome,
  }));

  const otherExplanations = validRows
    .filter((row) => row.conversionReason === "OTHER")
    .map((row) => row.conversionReasonNote?.trim())
    .filter((note): note is string => Boolean(note));

  return {
    period,
    summary,
    reasons,
    byOutcome,
    byProduct,
    byOwner,
    matrix,
    otherExplanations,
  };
}
