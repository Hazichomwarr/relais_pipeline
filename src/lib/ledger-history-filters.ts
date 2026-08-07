import type {
  LedgerEntryCategory,
  LedgerEntryType,
  RelaisProduct,
} from "@prisma/client";

import {
  getProductRequirementForCategory,
  isCategoryAllowedForType,
} from "@/src/lib/financial-ledger-options";
import { ledgerEntryCategories, ledgerEntryTypes } from "@/src/lib/validations/financial-ledger.schema";
import { relaisProducts } from "@/src/lib/validations/prospect.schema";
import type { LedgerEntryListFilters } from "@/src/services/financial-ledger.service-core";

export type LedgerHistoryFilterParams = {
  type?: string;
  category?: string;
  product?: string;
};

export type LedgerHistoryFilter = Pick<
  LedgerEntryListFilters,
  "type" | "category" | "product"
>;

/**
 * Never throws: a missing, unrecognized, or internally-inconsistent
 * combination of type/category/product (stale from a copied URL, back
 * button, or hand-edited query string) is silently dropped down to the
 * nearest valid state instead of erroring the page (Ticket 17C.1).
 */
export function parseLedgerHistoryFilter(
  params: LedgerHistoryFilterParams,
): LedgerHistoryFilter {
  const type = (ledgerEntryTypes as readonly string[]).includes(
    params.type ?? "",
  )
    ? (params.type as LedgerEntryType)
    : undefined;

  if (!type) {
    return {};
  }

  const categoryCandidate = params.category;
  const category =
    categoryCandidate &&
    (ledgerEntryCategories as readonly string[]).includes(categoryCandidate) &&
    isCategoryAllowedForType(type, categoryCandidate as LedgerEntryCategory)
      ? (categoryCandidate as LedgerEntryCategory)
      : undefined;

  if (!category) {
    return { type };
  }

  const productCandidate = params.product;
  const product =
    productCandidate &&
    (relaisProducts as readonly string[]).includes(productCandidate) &&
    getProductRequirementForCategory(category) !== "forbidden"
      ? (productCandidate as RelaisProduct)
      : undefined;

  return product ? { type, category, product } : { type, category };
}

/**
 * Switching direction always resets category/product — the previous
 * category set belonged to the old direction and can't carry over
 * (Ticket 17C.1's stale-filter cleanup rule).
 */
export function buildLedgerHistoryTypeUrl(type: LedgerEntryType | ""): string {
  return type ? `/finances?type=${type}` : "/finances";
}

/** Changing category always resets product — see buildLedgerHistoryTypeUrl. */
export function buildLedgerHistoryCategoryUrl(
  type: LedgerEntryType,
  category: LedgerEntryCategory | "",
): string {
  const params = new URLSearchParams({ type });

  if (category) {
    params.set("category", category);
  }

  return `/finances?${params.toString()}`;
}

export function buildLedgerHistoryProductUrl(
  type: LedgerEntryType,
  category: LedgerEntryCategory,
  product: RelaisProduct | "",
): string {
  const params = new URLSearchParams({ type, category });

  if (product) {
    params.set("product", product);
  }

  return `/finances?${params.toString()}`;
}
