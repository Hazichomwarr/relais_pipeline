import Link from "next/link";

import CommercialProspectFilters from "@/component/commercial/CommercialProspectFilters";
import {
  interestOptions,
  productOptions,
  prospectStatusOptions,
} from "@/src/lib/constants/prospect-options";
import type { CommercialProspectListItem } from "@/src/services/commercial-prospect.service";

function labelFor(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export default function CommercialProspectList({
  prospects,
  hasActiveFilters,
}: {
  prospects: CommercialProspectListItem[];
  hasActiveFilters: boolean;
}) {
  return (
    <section id="mes-prospects" className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-bold text-[#0f2557]">Mes prospects</h2>

      <div className="mt-5">
        <CommercialProspectFilters />
      </div>

      {prospects.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 p-6 text-center text-slate-500">
          {hasActiveFilters ? (
            <>
              <p>Aucun prospect ne correspond aux filtres sélectionnés.</p>
              <Link
                href="/dashboard/commercial"
                className="mt-2 inline-block font-semibold text-blue-600 hover:underline"
              >
                Réinitialiser les filtres
              </Link>
            </>
          ) : (
            <p>Aucun prospect ne vous est encore assigné.</p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <ul className="flex flex-col divide-y divide-slate-100">
            {prospects.map((prospect) => (
              <li
                key={prospect.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <Link
                    href={`/dashboard/commercial/prospects/${prospect.id}`}
                    className="font-semibold text-slate-900 hover:underline"
                  >
                    {prospect.name}
                  </Link>
                  <p className="text-sm text-slate-500">
                    {labelFor(productOptions, prospect.product)} ·{" "}
                    {prospect.phone}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {labelFor(prospectStatusOptions, prospect.status)}
                  </span>
                  <span>{labelFor(interestOptions, prospect.interest)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
