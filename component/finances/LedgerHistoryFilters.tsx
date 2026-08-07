"use client";

import type { LedgerEntryCategory, LedgerEntryType, RelaisProduct } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  getProductRequirementForCategory,
  inflowCategoryOptions,
  outflowCategoryOptions,
} from "@/src/lib/financial-ledger-options";
import { productOptions } from "@/src/lib/constants/prospect-options";
import {
  buildLedgerHistoryCategoryUrl,
  buildLedgerHistoryProductUrl,
  buildLedgerHistoryTypeUrl,
} from "@/src/lib/ledger-history-filters";

type LedgerHistoryFiltersProps = {
  type?: LedgerEntryType;
  category?: LedgerEntryCategory;
  product?: RelaisProduct;
};

const selectClassName =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100";

/**
 * The user always picks a direction (Tous/Entrées/Sorties) before
 * drilling into a category — "Tous" hides the category selector
 * entirely (Ticket 17C.1's "keep the interface simple" rule).
 */
export default function LedgerHistoryFilters({
  type,
  category,
  product,
}: LedgerHistoryFiltersProps) {
  const router = useRouter();

  const categoryOptions =
    type === "INFLOW"
      ? inflowCategoryOptions
      : type === "OUTFLOW"
        ? outflowCategoryOptions
        : [];

  return (
    <div className="flex flex-col gap-4">
      <nav
        aria-label="Filtrer les mouvements financiers par type"
        className="flex flex-wrap gap-2"
      >
        <FilterTab href={buildLedgerHistoryTypeUrl("")} label="Tous" active={!type} />
        <FilterTab
          href={buildLedgerHistoryTypeUrl("INFLOW")}
          label="Entrées"
          active={type === "INFLOW"}
        />
        <FilterTab
          href={buildLedgerHistoryTypeUrl("OUTFLOW")}
          label="Sorties"
          active={type === "OUTFLOW"}
        />
      </nav>

      {type && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Catégorie
            </span>
            <select
              value={category ?? ""}
              onChange={(event) =>
                router.push(
                  buildLedgerHistoryCategoryUrl(
                    type,
                    event.target.value as LedgerEntryCategory | "",
                  ),
                )
              }
              className={selectClassName}
            >
              <option value="">Toutes les catégories</option>
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {category &&
            getProductRequirementForCategory(category) !== "forbidden" && (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Produit
                </span>
                <select
                  value={product ?? ""}
                  onChange={(event) =>
                    router.push(
                      buildLedgerHistoryProductUrl(
                        type,
                        category,
                        event.target.value as RelaisProduct | "",
                      ),
                    )
                  }
                  className={selectClassName}
                >
                  <option value="">Tous les produits</option>
                  {productOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
        </div>
      )}
    </div>
  );
}

function FilterTab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
        active ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {label}
    </Link>
  );
}
