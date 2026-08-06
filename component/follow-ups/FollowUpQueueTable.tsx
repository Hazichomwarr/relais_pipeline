import { Eye } from "lucide-react";
import Link from "next/link";

import { appendReturnTo } from "@/src/lib/return-to";
import type { FollowUpQueueItem } from "@/src/services/follow-up.service";

export default function FollowUpQueueTable({
  items,
  returnTo,
}: {
  items: FollowUpQueueItem[];
  returnTo: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-4xl border border-slate-200 bg-white px-6 py-16 text-center">
        <p className="text-5xl" aria-hidden="true">
          🎉
        </p>
        <h2 className="mt-5 text-2xl font-bold text-[#0f2557]">
          Aucun suivi en attente.
        </h2>
        <p className="mt-2 text-slate-500">Toute l’équipe est à jour.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-4xl border border-slate-200 bg-white">
      {/* Mobile / tablet: follow-up cards */}
      <div className="flex flex-col gap-4 p-4 lg:hidden">
        {items.map((item) => (
          <article
            key={item.id}
            className="rounded-3xl border border-slate-200 bg-[#fafbff] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-800">
                  {item.name}
                </p>
                <p className="text-sm text-slate-500">{item.prospectType}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${getPriorityStyles(item.overdueDays)}`}
              >
                {item.followUpLabel}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                {productLabels[item.product]}
              </span>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-medium ${interestStyles[item.interest]}`}
              >
                {interestLabels[item.interest]}
              </span>
            </div>

            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-400">Téléphone</dt>
                <dd>
                  <a
                    href={`tel:${item.phone}`}
                    className="font-medium text-blue-700 hover:underline"
                  >
                    {item.phone}
                  </a>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-400">Commercial</dt>
                <dd className="min-w-0 truncate text-right font-medium text-slate-700">
                  {item.commercialName}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-400">Prochaine action</dt>
                <dd className="min-w-0 truncate text-right font-medium text-slate-700">
                  {item.nextAction
                    ? nextActionLabels[item.nextAction]
                    : "À définir"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-400">Date de suivi</dt>
                <dd className="text-right font-medium text-slate-700">
                  {item.followUpDate
                    ? item.followUpDate.toLocaleString("fr-FR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "À planifier"}
                </dd>
              </div>
            </dl>

            <Link
              href={appendReturnTo(`/admin/prospects/${item.id}`, returnTo)}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50"
            >
              <Eye className="h-4 w-4" />
              Voir le prospect
            </Link>
          </article>
        ))}
      </div>

      {/* Desktop: full data table */}
      <div className="hidden overflow-x-auto p-6 lg:block">
        <table className="w-full min-w-300 border-separate border-spacing-y-3">
          <thead>
            <tr className="text-left text-sm font-medium text-slate-500">
              <th className="pb-2">Prospect</th>
              <th className="pb-2">Produit</th>
              <th className="pb-2">Commercial</th>
              <th className="pb-2">Téléphone</th>
              <th className="pb-2">Intérêt</th>
              <th className="pb-2">Prochaine action</th>
              <th className="pb-2">Date de suivi</th>
              <th className="pb-2">Priorité</th>
              <th className="pb-2 text-center">Voir</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="bg-[#fafbff] shadow-sm">
                <td className="rounded-l-2xl px-4 py-5">
                  <p className="font-semibold text-slate-800">{item.name}</p>
                  <p className="text-sm text-slate-500">{item.prospectType}</p>
                </td>
                <td className="px-4 py-5">
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                    {productLabels[item.product]}
                  </span>
                </td>
                <td className="px-4 py-5">{item.commercialName}</td>
                <td className="px-4 py-5">
                  <a
                    href={`tel:${item.phone}`}
                    className="font-medium text-blue-700 hover:underline"
                  >
                    {item.phone}
                  </a>
                </td>
                <td className="px-4 py-5">
                  <span
                    className={`rounded-full border px-3 py-1 text-sm font-medium ${interestStyles[item.interest]}`}
                  >
                    {interestLabels[item.interest]}
                  </span>
                </td>
                <td className="px-4 py-5">
                  {item.nextAction
                    ? nextActionLabels[item.nextAction]
                    : "À définir"}
                </td>
                <td className="px-4 py-5">
                  {item.followUpDate
                    ? item.followUpDate.toLocaleString("fr-FR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "À planifier"}
                </td>
                <td className="px-4 py-5">
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-semibold ${getPriorityStyles(item.overdueDays)}`}
                  >
                    {item.followUpLabel}
                  </span>
                </td>
                <td className="rounded-r-2xl px-4 py-5">
                  <div className="flex justify-center">
                    <Link
                      href={appendReturnTo(`/admin/prospects/${item.id}`, returnTo)}
                      aria-label={`Voir ${item.name}`}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white transition hover:bg-slate-50"
                    >
                      <Eye className="h-5 w-5 text-slate-600" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-slate-100 px-6 py-4 text-sm text-slate-500">
        {items.length} suivi{items.length > 1 ? "s" : ""} à traiter
      </p>
    </div>
  );
}

const productLabels = {
  KARMDA: "KARMDA",
  LOKARI: "LOKARI",
  NIA: "NIA",
  DIGITAL_SERVICES: "Services digitaux",
};

const interestLabels = {
  NOT_INTERESTED: "Pas intéressé",
  MAYBE: "Peut-être",
  NEEDS_INFORMATION: "Veut plus d’informations",
  INTERESTED: "Intéressé",
  READY_TO_DISCUSS: "Prêt à discuter",
};

const interestStyles = {
  NOT_INTERESTED: "border-red-200 bg-red-100 text-red-700",
  MAYBE: "border-slate-200 bg-slate-100 text-slate-700",
  NEEDS_INFORMATION: "border-amber-200 bg-amber-100 text-amber-700",
  INTERESTED: "border-green-200 bg-green-100 text-green-700",
  READY_TO_DISCUSS: "border-green-200 bg-green-100 text-green-700",
};

const nextActionLabels = {
  CALL_BACK: "Rappeler",
  VISIT_AGAIN: "Repasser sur place",
  SEND_DEMO: "Envoyer une démonstration",
  SCHEDULE_MEETING: "Organiser une rencontre",
  NO_ACTION: "Aucune action",
};

function getPriorityStyles(overdueDays: number | null) {
  if (overdueDays === null) {
    return "bg-slate-100 text-slate-700";
  }
  if (overdueDays > 0) {
    return "bg-red-100 text-red-700";
  }
  if (overdueDays === 0) {
    return "bg-blue-100 text-blue-700";
  }
  return "bg-amber-100 text-amber-700";
}
