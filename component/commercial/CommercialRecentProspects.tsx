import Link from "next/link";

import {
  interestOptions,
  productOptions,
  prospectStatusOptions,
} from "@/src/lib/constants/prospect-options";
import type { CommercialDashboard } from "@/src/services/commercial-dashboard.service";

function labelFor(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
});

export default function CommercialRecentProspects({
  prospects,
}: {
  prospects: CommercialDashboard["recentProspects"];
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-bold text-[#0f2557]">
        Prospects récents
      </h2>

      {prospects.length === 0 ? (
        <p className="mt-4 text-slate-500">
          Aucun prospect ne vous est encore assigné.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <ul className="flex flex-col divide-y divide-slate-100">
            {prospects.map((prospect) => (
              <li key={prospect.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link
                    href={`/dashboard/commercial/prospects/${prospect.id}`}
                    className="font-semibold text-slate-900 hover:underline"
                  >
                    {prospect.name}
                  </Link>
                  <p className="text-sm text-slate-500">
                    {labelFor(productOptions, prospect.product)} ·{" "}
                    {labelFor(interestOptions, prospect.interest)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {labelFor(prospectStatusOptions, prospect.status)}
                  </span>
                  <span>{dateFormatter.format(prospect.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
