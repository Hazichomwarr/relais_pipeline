import type { RelaisProduct } from "@prisma/client";

import { relaisProducts } from "@/src/lib/validations/prospect.schema";
import { salesFunnelPeriods, type SalesFunnelPeriodKey } from "@/src/lib/sales-funnel-period";

export type SalesFunnelAnalyticsFilters = {
  period: SalesFunnelPeriodKey;
  product?: RelaisProduct;
  ownerUserId?: string;
};

export type SalesFunnelAnalyticsFilterParams = {
  period?: string;
  product?: string;
  owner?: string;
};

/**
 * Never throws: a missing, unrecognized, or hand-edited query string
 * silently falls back to the nearest safe default — same convention as
 * parseLedgerHistoryFilter/parseProspectActionQueueFilters. `owner` is
 * passed through as an opaque id: an unknown value simply matches zero
 * prospects in the service query, which is safe on its own.
 */
export function parseSalesFunnelAnalyticsFilters(
  params: SalesFunnelAnalyticsFilterParams,
): SalesFunnelAnalyticsFilters {
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

  return { period, product, ownerUserId };
}

export function updateSalesFunnelAnalyticsParam(
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
  return query ? `/admin/analytics/funnel?${query}` : "/admin/analytics/funnel";
}
