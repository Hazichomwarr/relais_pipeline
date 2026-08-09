import { SearchX } from "lucide-react";
import Link from "next/link";

export default function ManagementReportNotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center rounded-4xl border border-slate-200 bg-white p-9 text-center shadow-sm">
      <SearchX className="h-12 w-12 text-slate-400" />
      <h1 className="mt-5 text-3xl font-bold text-[#0f2557]">
        Rapport introuvable
      </h1>
      <p className="mt-3 leading-7 text-slate-500">
        Ce rapport n&apos;existe pas ou a été supprimé.
      </p>
      <Link
        href="/admin/reports"
        className="mt-7 inline-flex h-12 items-center justify-center rounded-xl bg-[#0f2557] px-6 font-semibold text-white"
      >
        Retour aux rapports quotidiens
      </Link>
    </div>
  );
}
