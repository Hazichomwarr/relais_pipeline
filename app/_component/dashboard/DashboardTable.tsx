import {
  ChevronLeft,
  ChevronRight,
  Eye,
  RotateCcw,
  Search,
} from "lucide-react";
import { Report } from "../ReportForm";
import { report } from "process";

export default function DashboardTable({ reports }: { reports: Report[] }) {
  return (
    <div className="mt-8 rounded-4xl border border-slate-200 bg-white p-6">
      {/* FILTERS */}
      <div className="mb-8 flex flex-col gap-4 xl:flex-row">
        {/* SEARCH */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

          <input
            type="text"
            placeholder="Rechercher une entreprise, un contact..."
            className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 outline-none focus:border-[#0f2557]"
          />
        </div>

        {/* FILTERS */}
        <select className="h-14 rounded-2xl border border-slate-200 bg-white px-4 text-slate-600 outline-none">
          <option>Tous les commerciaux</option>
        </select>

        <select className="h-14 rounded-2xl border border-slate-200 bg-white px-4 text-slate-600 outline-none">
          <option>Tous les niveaux</option>
        </select>

        <select className="h-14 rounded-2xl border border-slate-200 bg-white px-4 text-slate-600 outline-none">
          <option>Tous les types</option>
        </select>

        <button className="flex h-14 items-center gap-2 rounded-2xl border border-slate-200 px-5 font-medium text-slate-600">
          <RotateCcw className="h-4 w-4" />
          Réinitialiser
        </button>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-300 border-separate border-spacing-y-3">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="pb-3">Date</th>
              <th className="pb-3">Entreprise</th>
              <th className="pb-3">Type</th>
              <th className="pb-3">Contact</th>
              <th className="pb-3">agent</th>
              <th className="pb-3">Niveau d’intérêt</th>
              <th className="pb-3">Notes</th>
              <th className="pb-3 text-center">Actions</th>
            </tr>
          </thead>

          <tbody>
            {reports.map((report, index) => {
              const date = new Date(report.created_at!);
              const formattedDate = date.toLocaleDateString("fr-FR");
              const formattedTime = date.toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <tr key={index} className="rounded-2xl bg-[#fafbff] shadow-sm">
                  <td className="rounded-l-2xl px-4 py-5">
                    <div>
                      <p className="font-medium">{formattedDate}</p>
                      <p className="text-sm text-slate-500">{formattedTime}</p>
                    </div>
                  </td>

                  <td className="px-4 py-5 font-semibold">
                    {report.entreprise}
                  </td>

                  <td className="px-4 py-5">
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                      {report.type}
                    </span>
                  </td>

                  <td className="px-4 py-5">
                    <div>
                      <p className="font-medium">{report.contact}</p>
                      <p className="text-sm text-slate-500">
                        {report.platform}
                      </p>
                    </div>
                  </td>

                  <td className="px-4 py-5">{report.agent}</td>

                  <td className="px-4 py-5">
                    <span
                      className={`rounded-full border px-3 py-1 text-sm font-medium ${getInterestStyles(
                        report.interest,
                      )}`}
                    >
                      {report.interest}
                    </span>
                  </td>

                  <td className="max-w-65 px-4 py-5 text-sm text-slate-600">
                    {report.notes}
                  </td>

                  <td className="rounded-r-2xl px-4 py-5">
                    <div className="flex justify-center">
                      <button className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50">
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

      {/* PAGINATION */}
      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-slate-500">Affichage de 1 à 5 sur 58 rapports</p>

        <div className="flex items-center gap-2">
          <button className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white">
            <ChevronLeft className="h-5 w-5" />
          </button>

          <button className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500 font-medium text-white">
            1
          </button>

          <button className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white">
            2
          </button>

          <button className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white">
            3
          </button>

          <span className="px-2 text-slate-400">...</span>

          <button className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white">
            12
          </button>

          <button className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function getInterestStyles(interest: string) {
  switch (interest) {
    case "Intéressé":
      return "bg-green-100 text-green-700 border-green-200";

    case "Veut plus d’informations":
      return "bg-amber-100 text-amber-700 border-amber-200";

    case "Peut-être":
      return "bg-slate-100 text-slate-700 border-slate-200";

    default:
      return "bg-red-100 text-red-700 border-red-200";
  }
}
