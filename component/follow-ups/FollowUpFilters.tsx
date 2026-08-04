"use client";

import { RotateCcw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  followUpActionOptions,
  interestOptions,
  productOptions,
} from "@/src/lib/constants/prospect-options";
import { buildFollowUpUrl } from "@/src/lib/follow-up-search-params";

export type FollowUpUserFilterOption = {
  id: string;
  firstName: string;
  lastName: string;
  active: boolean;
};

export default function FollowUpFilters({
  users,
}: {
  users: FollowUpUserFilterOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParameter(name: string, value: string) {
    router.push(buildFollowUpUrl(searchParams.toString(), name, value));
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <FilterSelect
        label="Commercial assigné"
        value={searchParams.get("userId") ?? ""}
        onChange={(value) => updateParameter("userId", value)}
      >
        <option value="">Tous les commerciaux</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.firstName} {user.lastName}
            {user.active ? "" : " — inactif"}
          </option>
        ))}
      </FilterSelect>

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
        label="Prochaine action"
        value={searchParams.get("nextAction") ?? ""}
        onChange={(value) => updateParameter("nextAction", value)}
      >
        <option value="">Toutes les prochaines actions</option>
        {followUpActionOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </FilterSelect>

      <button
        type="button"
        onClick={() => router.push("/admin/follow-ups")}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 font-medium text-slate-600 transition hover:bg-slate-50"
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
      className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-600 outline-none focus:border-[#0f2557]"
    >
      {children}
    </select>
  );
}
