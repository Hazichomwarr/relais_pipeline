"use client";

import { RotateCcw, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";

import {
  interestOptions,
  productOptions,
  prospectStatusOptions,
} from "@/src/lib/constants/prospect-options";
import { buildCommercialDashboardUrl } from "@/src/lib/commercial-dashboard-search-params";

export default function CommercialProspectFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateInputRef = useRef<HTMLInputElement>(null);
  const selectedDate = searchParams.get("date") ?? "";

  function updateParameter(name: string, value: string) {
    router.push(
      buildCommercialDashboardUrl(searchParams.toString(), name, value),
    );
  }

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <form
        className="relative flex-1 sm:min-w-64"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          updateParameter(
            "search",
            String(formData.get("search") ?? "").trim(),
          );
        }}
      >
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          name="search"
          key={searchParams.get("search") ?? ""}
          defaultValue={searchParams.get("search") ?? ""}
          placeholder="Rechercher un prospect, un contact..."
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 outline-none focus:border-[#0f2557]"
        />
      </form>

      <FilterSelect
        label="Produit"
        value={searchParams.get("product") ?? ""}
        onChange={(value) => updateParameter("product", value)}
      >
        <option value="">Tous les produits</option>
        {productOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        label="Niveau d’intérêt"
        value={searchParams.get("interest") ?? ""}
        onChange={(value) => updateParameter("interest", value)}
      >
        <option value="">Tous les niveaux d’intérêt</option>
        {interestOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        label="Statut"
        value={searchParams.get("status") ?? ""}
        onChange={(value) => updateParameter("status", value)}
      >
        <option value="">Tous les statuts</option>
        {prospectStatusOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </FilterSelect>

      <button
        type="button"
        onClick={() => dateInputRef.current?.showPicker()}
        className="flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-slate-600"
      >
        {selectedDate || "Date de création"}
        <input
          ref={dateInputRef}
          type="date"
          value={selectedDate}
          onChange={(event) => updateParameter("date", event.target.value)}
          className="pointer-events-none absolute opacity-0"
        />
      </button>

      <button
        type="button"
        onClick={() => router.push("/dashboard/commercial")}
        className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 font-medium text-slate-600 transition hover:bg-slate-50"
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
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-slate-600 outline-none focus:border-[#0f2557]"
    >
      {children}
    </select>
  );
}
