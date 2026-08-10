import { Eye } from "lucide-react";
import Link from "next/link";

import {
  formatDateTime,
  getInterestLabel,
  getInterestStyles,
  getProductLabel,
  getStatusLabel,
} from "@/component/propects/prospect-detail-sections";
import { followUpActionOptions } from "@/src/lib/constants/prospect-options";
import { appendReturnTo } from "@/src/lib/return-to";
import type { AdminMyProspectListItem } from "@/src/services/admin-my-prospects.service";

function labelFor(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

type AdminMyProspectsListProps = {
  prospects: AdminMyProspectListItem[];
  hasOwnedProspects: boolean;
  returnTo: string;
};

export default function AdminMyProspectsList({
  prospects,
  hasOwnedProspects,
  returnTo,
}: AdminMyProspectsListProps) {
  if (prospects.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center">
        {hasOwnedProspects ? (
          <>
            <p className="text-slate-600">
              Aucun de vos prospects ne correspond à ces filtres.
            </p>
            <Link
              href="/admin/my-prospects"
              className="mt-3 inline-block font-semibold text-blue-600 hover:underline"
            >
              Réinitialiser les filtres
            </Link>
          </>
        ) : (
          <>
            <p className="text-slate-600">
              Aucun prospect personnel pour le moment.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Lorsque vous soumettez un rapport de prospection, le prospect
              apparaîtra ici.
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex h-12 items-center justify-center rounded-2xl bg-[#0f2557] px-6 font-semibold text-white transition hover:opacity-95"
            >
              Prospecter
            </Link>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">
      {/* Mobile / tablet: cards */}
      <div className="flex flex-col gap-4 lg:hidden">
        {prospects.map((prospect) => (
          <article
            key={prospect.id}
            className="rounded-3xl border border-slate-200 bg-[#fafbff] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 truncate font-semibold text-slate-900">
                {prospect.name}
              </p>
              <span className="shrink-0 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                {getProductLabel(prospect.product)}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-xs font-medium ${getInterestStyles(
                  prospect.interest,
                )}`}
              >
                {getInterestLabel(prospect.interest)}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {getStatusLabel(prospect.status)}
              </span>
            </div>

            {prospect.nextAction && (
              <p className="mt-3 text-sm text-slate-500">
                Prochaine action :{" "}
                <span className="font-medium text-slate-700">
                  {labelFor(followUpActionOptions, prospect.nextAction)}
                </span>
              </p>
            )}

            <p className="mt-1 text-sm text-slate-400">
              {formatDateTime(prospect.createdAt)}
            </p>

            <Link
              href={appendReturnTo(`/admin/prospects/${prospect.id}`, returnTo)}
              className="mt-4 flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 font-medium text-slate-700 hover:bg-slate-50"
            >
              <Eye className="h-4 w-4" />
              Voir le prospect
            </Link>
          </article>
        ))}
      </div>

      {/* Desktop: compact table */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-0 border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-100 text-sm text-slate-500">
              <th className="py-3 pr-4 font-medium">Prospect</th>
              <th className="py-3 pr-4 font-medium">Produit</th>
              <th className="py-3 pr-4 font-medium">Statut</th>
              <th className="py-3 pr-4 font-medium">Intérêt</th>
              <th className="py-3 pr-4 font-medium">Prochaine action</th>
              <th className="py-3 pr-4 font-medium">Date</th>
              <th className="py-3 pr-4 font-medium sr-only">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {prospects.map((prospect) => (
              <tr key={prospect.id} className="text-sm">
                <td className="max-w-64 truncate py-3 pr-4 font-medium text-slate-900">
                  {prospect.name}
                </td>
                <td className="py-3 pr-4 text-slate-600">
                  {getProductLabel(prospect.product)}
                </td>
                <td className="py-3 pr-4">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {getStatusLabel(prospect.status)}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${getInterestStyles(
                      prospect.interest,
                    )}`}
                  >
                    {getInterestLabel(prospect.interest)}
                  </span>
                </td>
                <td className="py-3 pr-4 text-slate-600">
                  {prospect.nextAction
                    ? labelFor(followUpActionOptions, prospect.nextAction)
                    : "—"}
                </td>
                <td className="py-3 pr-4 text-slate-500">
                  {formatDateTime(prospect.createdAt)}
                </td>
                <td className="py-3 pr-4 text-right">
                  <Link
                    href={appendReturnTo(
                      `/admin/prospects/${prospect.id}`,
                      returnTo,
                    )}
                    className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Eye className="h-4 w-4" />
                    Voir
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

