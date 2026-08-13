import type { ProspectConversionOutcome, RelaisProduct } from "@prisma/client";

import { relaisProducts } from "@/src/lib/validations/prospect.schema";
import { salesFunnelPeriods, type SalesFunnelPeriodKey } from "@/src/lib/sales-funnel-period";

const conversionOutcomes: readonly ProspectConversionOutcome[] = [
  "ADVANCED",
  "STALLED",
  "WON",
  "LOST",
];

export type SalesWhyAnalyticsFilters = {
  period: SalesFunnelPeriodKey;
  product?: RelaisProduct;
  ownerUserId?: string;
  outcome?: ProspectConversionOutcome;
};

export type SalesWhyAnalyticsFilterParams = {
  period?: string;
  product?: string;
  owner?: string;
  outcome?: string;
};

/**
 * Never throws — same convention as parseSalesFunnelAnalyticsFilters: a
 * missing, unrecognized, or hand-edited query string silently falls back to
 * the nearest safe default.
 */
export function parseSalesWhyAnalyticsFilters(
  params: SalesWhyAnalyticsFilterParams,
): SalesWhyAnalyticsFilters {
  const period = (salesFunnelPeriods as readonly string[]).includes(
    params.period ?? "",
  )
    ? (params.period as SalesFunnelPeriodKey)
    : "month";

  const product =
    params.product &&
    (relaisProducts as readonly string[]).includes(params.product)
      ? (params.product as RelaisProduct)
      : undefined;

  const ownerUserId = params.owner?.trim() || undefined;

  const outcome = (conversionOutcomes as readonly string[]).includes(
    params.outcome ?? "",
  )
    ? (params.outcome as ProspectConversionOutcome)
    : undefined;

  return { period, product, ownerUserId, outcome };
}

export function updateSalesWhyAnalyticsParam(
  currentSearchParams: string,
  name: string,
  value: string,
): string {
  const nextParams = new URLSearchParams(currentSearchParams);

  if (value) {
    nextParams.set(name, value);
  } else {
    nextParams.delete(name);
  }

  const query = nextParams.toString();
  return query ? `/admin/analytics/why?${query}` : "/admin/analytics/why";
}
