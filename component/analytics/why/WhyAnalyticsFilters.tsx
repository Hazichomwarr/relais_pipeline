"use client";

import { RotateCcw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { conversionOutcomeOptions } from "@/src/lib/prospect-conversion-options";
import { productOptions } from "@/src/lib/constants/prospect-options";
import { updateSalesWhyAnalyticsParam } from "@/src/lib/sales-why-analytics-filters";

const periodOptions = [
  { value: "today", label: "Aujourd’hui" },
  { value: "week", label: "Cette semaine" },
  { value: "month", label: "Ce mois" },
  { value: "year", label: "Cette année" },
  { value: "all", label: "Tout" },
] as const;

export type WhyAnalyticsOwnerOption = {
  id: string;
  firstName: string;
  lastName: string;
};

export default function WhyAnalyticsFilters({
  owners,
}: {
  owners: WhyAnalyticsOwnerOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParameter(name: string, value: string) {
    router.push(updateSalesWhyAnalyticsParam(searchParams.toString(), name, value));
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <FilterSelect
        label="Période"
        value={searchParams.get("period") ?? "month"}
        onChange={(value) => updateParameter("period", value)}
      >
        {periodOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        label="Produit"
        value={searchParams.get("product") ?? ""}
        onChange={(value) => updateParameter("product", value)}
      >
        <option value="">Tous</option>
        {productOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        label="Commercial"
        value={searchParams.get("owner") ?? ""}
        onChange={(value) => updateParameter("owner", value)}
      >
        <option value="">Tous</option>
        {owners.map((owner) => (
          <option key={owner.id} value={owner.id}>
            {owner.firstName} {owner.lastName}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        label="Résultat"
        value={searchParams.get("outcome") ?? ""}
        onChange={(value) => updateParameter("outcome", value)}
      >
        <option value="">Tous les résultats</option>
        {conversionOutcomeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </FilterSelect>

      <button
        type="button"
        onClick={() => router.push("/admin/analytics/why")}
        className="flex h-12 items-center justify-center gap-2 self-end rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
      >
        <RotateCcw className="h-4 w-4" />
        Réinitialiser
      </button>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-600 outline-none focus:border-[#0f2557]"
      >
        {children}
      </select>
    </label>
  );
}
