"use client";

import { RotateCcw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { productOptions } from "@/src/lib/constants/prospect-options";
import { updateProspectActionQueueParam } from "@/src/lib/prospect-action-queue-filters";

export type ProspectActionQueueAssigneeOption = {
  id: string;
  firstName: string;
  lastName: string;
};

export default function ProspectActionQueueFilters({
  assignableUsers,
}: {
  assignableUsers: ProspectActionQueueAssigneeOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParameter(name: string, value: string) {
    router.push(updateProspectActionQueueParam(searchParams.toString(), name, value));
  }

  const scope = searchParams.get("scope") === "MINE" ? "MINE" : "ALL";

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <ScopeButton
          active={scope === "ALL"}
          onClick={() => updateParameter("scope", "")}
        >
          Toutes les actions
        </ScopeButton>
        <ScopeButton
          active={scope === "MINE"}
          onClick={() => updateParameter("scope", "MINE")}
        >
          Mes actions
        </ScopeButton>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FilterSelect
          label="Responsable"
          value={searchParams.get("assignee") ?? ""}
          onChange={(value) => updateParameter("assignee", value)}
        >
          <option value="">Tous</option>
          {assignableUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.firstName} {user.lastName}
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
          label="Échéance"
          value={searchParams.get("bucket") ?? ""}
          onChange={(value) => updateParameter("bucket", value)}
        >
          <option value="">Toutes</option>
          <option value="OVERDUE">En retard</option>
          <option value="TODAY">Aujourd’hui</option>
          <option value="UPCOMING">À venir</option>
        </FilterSelect>
      </div>

      <button
        type="button"
        onClick={() => router.push("/actions")}
        className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
      >
        <RotateCcw className="h-4 w-4" />
        Réinitialiser
      </button>
    </div>
  );
}

function ScopeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-11 rounded-2xl px-5 text-sm font-semibold transition ${
        active
          ? "bg-[#0f2557] text-white"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
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
