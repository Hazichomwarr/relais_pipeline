import type { ProspectListItem } from "@/src/services/prospect.service";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  RotateCcw,
  Search,
} from "lucide-react";

type DashboardTableProps = {
  prospects: ProspectListItem[];
};

export default function DashboardTable({ prospects }: DashboardTableProps) {
  return (
    <div className="mt-8 rounded-4xl border border-slate-200 bg-white p-6">
      <div className="mb-8 flex flex-col gap-4 xl:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

          <input
            type="text"
            placeholder="Rechercher un prospect, un contact..."
            className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 outline-none focus:border-[#0f2557]"
          />
        </div>

        <select className="h-14 rounded-2xl border border-slate-200 bg-white px-4 text-slate-600 outline-none">
          <option value="">Tous les commerciaux</option>
        </select>

        <select className="h-14 rounded-2xl border border-slate-200 bg-white px-4 text-slate-600 outline-none">
          <option value="">Tous les niveaux d’intérêt</option>
        </select>

        <select className="h-14 rounded-2xl border border-slate-200 bg-white px-4 text-slate-600 outline-none">
          <option value="">Tous les produits</option>
        </select>

        <button
          type="button"
          className="flex h-14 items-center gap-2 rounded-2xl border border-slate-200 px-5 font-medium text-slate-600"
        >
          <RotateCcw className="h-4 w-4" />
          Réinitialiser
        </button>
      </div>

      <div className="overflow-x-auto">
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

                  <td className="px-4 py-5">{prospect.agentName}</td>

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
                      <button
                        type="button"
                        aria-label={`Voir ${prospect.name}`}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
                      >
                        <Eye className="h-5 w-5 text-slate-600" />
                      </button>
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
