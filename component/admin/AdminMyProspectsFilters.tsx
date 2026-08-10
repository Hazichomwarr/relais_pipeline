"use client";

import { RotateCcw, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  productOptions,
  prospectStatusOptions,
} from "@/src/lib/constants/prospect-options";

const BASE_PATH = "/admin/my-prospects";

export default function AdminMyProspectsFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParameter(name: string, value: string) {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (value) {
      nextParams.set(name, value);
    } else {
      nextParams.delete(name);
    }

    const query = nextParams.toString();
    router.push(query ? `${BASE_PATH}?${query}` : BASE_PATH);
  }

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <form
        className="relative flex-1 sm:min-w-64"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          updateParameter("q", String(formData.get("q") ?? "").trim());
        }}
      >
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          name="q"
          key={searchParams.get("q") ?? ""}
          defaultValue={searchParams.get("q") ?? ""}
          placeholder="Rechercher un prospect..."
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
        onClick={() => router.push(BASE_PATH)}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 font-medium text-slate-600 transition hover:bg-slate-50 sm:w-auto"
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
      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-600 outline-none focus:border-[#0f2557] sm:w-auto"
    >
      {children}
    </select>
  );
}
