import { SearchX } from "lucide-react";
import Link from "next/link";

export default function ProspectNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-5 text-slate-800">
      <div className="w-full max-w-lg rounded-4xl border border-slate-200 bg-white p-9 text-center shadow-sm">
        <SearchX className="mx-auto h-12 w-12 text-slate-400" />
        <h1 className="mt-5 text-3xl font-bold text-[#0f2557]">
          Prospect introuvable
        </h1>
        <p className="mt-3 leading-7 text-slate-500">
          Ce prospect n’existe pas ou a été retiré de la base de données.
        </p>
        <Link
          href="/admin"
          className="mt-7 inline-flex h-12 items-center justify-center rounded-xl bg-[#0f2557] px-6 font-semibold text-white"
        >
          Retour au tableau de bord
        </Link>
      </div>
    </main>
  );
}
