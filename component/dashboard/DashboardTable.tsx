import type { ProspectListItem } from "@/src/services/prospect.service";
import { getAssignedUserName } from "@/src/lib/prospect-ownership";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import Link from "next/link";
import DashboardFilters, {
  type DashboardUserFilterOption,
} from "./DashboardFilters";

type DashboardTableProps = {
  prospects: ProspectListItem[];
  filterUsers: DashboardUserFilterOption[];
};

export default function DashboardTable({
  prospects,
  filterUsers,
}: DashboardTableProps) {
  return (
    <div className="mt-8 rounded-4xl border border-slate-200 bg-white p-4 sm:p-6">
      <DashboardFilters users={filterUsers} />

      {/* Mobile / tablet: prioritized cards instead of a shrunk table */}
      <div className="flex flex-col gap-4 lg:hidden">
        {prospects.map((prospect) => (
          <article
            key={prospect.id}
            className="rounded-3xl border border-slate-200 bg-[#fafbff] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">
                  {prospect.name}
                </p>
                <p className="text-sm text-slate-500">
                  {prospect.prospectType}
                </p>
              </div>
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

            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-400">Contact</dt>
                <dd className="min-w-0 truncate text-right font-medium text-slate-700">
                  {prospect.contactName ?? "Non renseigné"}
                </dd>
              </div>
              {prospect.phone && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-400">Téléphone</dt>
                  <dd>
                    <a
                      href={`tel:${prospect.phone}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {prospect.phone}
                    </a>
                  </dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-400">Commercial</dt>
                <dd className="min-w-0 truncate text-right font-medium text-slate-700">
                  {getAssignedUserName(prospect)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-400">Prochaine action</dt>
                <dd className="min-w-0 truncate text-right font-medium text-slate-700">
                  {prospect.nextAction
                    ? getNextActionLabel(prospect.nextAction)
                    : "À définir"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-400">Suivi</dt>
                <dd className="text-right font-medium text-slate-700">
                  {prospect.followUpDate
                    ? prospect.followUpDate.toLocaleDateString("fr-FR")
                    : "À planifier"}
                </dd>
              </div>
            </dl>

            {prospect.notes && (
              <p className="mt-3 line-clamp-3 text-sm text-slate-600">
                {prospect.notes}
              </p>
            )}

            <Link
              href={`/admin/prospects/${prospect.id}`}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50"
            >
              <Eye className="h-4 w-4" />
              Voir le prospect
            </Link>
          </article>
        ))}
      </div>

      {/* Desktop: full data table */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-300 border-separate border-spacing-y-3">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="pb-3">Date</th>
              <th className="pb-3">Prospect</th>
              <th className="pb-3">Produit</th>
              <th className="pb-3">Contact</th>
              <th className="pb-3">Commercial</th>
              <th className="pb-3">Intérêt</th>
              <th className="pb-3">Statut</th>
              <th className="pb-3">Notes</th>
              <th className="pb-3 text-center">Actions</th>
            </tr>
          </thead>

          <tbody>
            {prospects.map((prospect) => {
              const formattedDate =
                prospect.createdAt.toLocaleDateString("fr-FR");

              const formattedTime = prospect.createdAt.toLocaleTimeString(
                "fr-FR",
                {
                  hour: "2-digit",
                  minute: "2-digit",
                },
              );

              return (
                <tr
                  key={prospect.id}
                  className="rounded-2xl bg-[#fafbff] shadow-sm"
                >
                  <td className="rounded-l-2xl px-4 py-5">
                    <p className="font-medium">{formattedDate}</p>
                    <p className="text-sm text-slate-500">{formattedTime}</p>
                  </td>

                  <td className="px-4 py-5">
                    <p className="font-semibold">{prospect.name}</p>
                    <p className="text-sm text-slate-500">
                      {prospect.prospectType}
                    </p>
                  </td>

                  <td className="px-4 py-5">
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                      {getProductLabel(prospect.product)}
                    </span>
                  </td>

                  <td className="px-4 py-5">
                    <p className="font-medium">
                      {prospect.contactName ?? "Responsable non renseigné"}
                    </p>
                    <p className="text-sm text-slate-500">{prospect.phone}</p>
                  </td>

                  <td className="px-4 py-5">
                    {getAssignedUserName(prospect)}
                  </td>

                  <td className="px-4 py-5">
                    <span
                      className={`rounded-full border px-3 py-1 text-sm font-medium ${getInterestStyles(
                        prospect.interest,
                      )}`}
                    >
                      {getInterestLabel(prospect.interest)}
                    </span>
                  </td>

                  <td className="px-4 py-5">
                    {getStatusLabel(prospect.status)}
                  </td>

                  <td className="max-w-65 px-4 py-5 text-sm text-slate-600">
                    {prospect.notes}
                  </td>

                  <td className="rounded-r-2xl px-4 py-5">
                    <div className="flex justify-center">
                      <Link
                        href={`/admin/prospects/${prospect.id}`}
                        aria-label={`Voir ${prospect.name}`}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
                      >
                        <Eye className="h-5 w-5 text-slate-600" />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {prospects.length === 0 && (
        <div className="py-14 text-center text-slate-500">
          Aucun prospect trouvé.
        </div>
      )}

      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-slate-500">
          {prospects.length} prospect{prospects.length > 1 ? "s" : ""}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500 font-medium text-white"
          >
            1
          </button>

          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function getNextActionLabel(nextAction: NonNullable<ProspectListItem["nextAction"]>) {
  const labels = {
    CALL_BACK: "Rappeler",
    VISIT_AGAIN: "Repasser sur place",
    SEND_DEMO: "Envoyer une démonstration",
    SCHEDULE_MEETING: "Organiser une rencontre",
    NO_ACTION: "Aucune action",
  };

  return labels[nextAction];
}

function getProductLabel(product: ProspectListItem["product"]) {
  const labels = {
    KARMDA: "KARMDA",
    LOKARI: "LOKARI",
    NIA: "NIA",
    DIGITAL_SERVICES: "Services digitaux",
  };

  return labels[product];
}

function getInterestLabel(interest: ProspectListItem["interest"]) {
  const labels = {
    NOT_INTERESTED: "❌ Pas intéressé",
    MAYBE: "🤔 Peut-être",
    NEEDS_INFORMATION: "👀 Veut plus d’informations",
    INTERESTED: "🔥 Intéressé",
    READY_TO_DISCUSS: "✅ Prêt à discuter",
  };

  return labels[interest];
}

function getStatusLabel(status: ProspectListItem["status"]) {
  const labels = {
    NEW: "Nouveau",
    TO_FOLLOW_UP: "À suivre",
    CONTACTED: "Contacté",
    QUALIFIED: "Qualifié",
    PROPOSAL_SENT: "Proposition envoyée",
    WON: "Gagné",
    LOST: "Perdu",
  };

  return labels[status];
}

function getInterestStyles(interest: ProspectListItem["interest"]) {
  switch (interest) {
    case "READY_TO_DISCUSS":
    case "INTERESTED":
      return "border-green-200 bg-green-100 text-green-700";

    case "NEEDS_INFORMATION":
      return "border-amber-200 bg-amber-100 text-amber-700";

    case "MAYBE":
      return "border-slate-200 bg-slate-100 text-slate-700";

    case "NOT_INTERESTED":
      return "border-red-200 bg-red-100 text-red-700";
  }
}
