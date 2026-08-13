import { resolveFinancialReportPeriod } from "@/src/lib/financial-report-period";

/**
 * Ticket 20F reuses the centralized business-date math from
 * financial-report-period.ts for today/week/month/year instead of a
 * second implementation — only "all" (no date bound at all) is genuinely
 * new, since financial reports never needed an unbounded period.
 */
export const salesFunnelPeriods = ["today", "week", "month", "year", "all"] as const;

export type SalesFunnelPeriodKey = (typeof salesFunnelPeriods)[number];

export type ResolvedSalesFunnelPeriod = {
  period: SalesFunnelPeriodKey;
  label: string;
  /** Inclusive start instant (UTC), or null for period="all" (no lower bound). */
  from: Date | null;
  /** Exclusive end instant (UTC), or null for period="all" (no upper bound). */
  toExclusive: Date | null;
};

export function resolveSalesFunnelPeriod(
  period: SalesFunnelPeriodKey,
  referenceDate: Date = new Date(),
): ResolvedSalesFunnelPeriod {
  if (period === "all") {
    return { period: "all", label: "Tout", from: null, toExclusive: null };
  }

  const resolved = resolveFinancialReportPeriod({ period }, referenceDate);

  return {
    period,
    label: resolved.label,
    from: resolved.from,
    toExclusive: resolved.toExclusive,
  };
}
