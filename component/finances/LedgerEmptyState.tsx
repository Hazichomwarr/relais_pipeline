import { PiggyBank, Plus } from "lucide-react";
import Link from "next/link";

export default function LedgerEmptyState({ canCreate }: { canCreate: boolean }) {
  return (
    <div className="rounded-4xl border border-slate-200 bg-white px-6 py-16 text-center">
      <PiggyBank className="mx-auto h-12 w-12 text-slate-400" aria-hidden="true" />
      <h2 className="mt-5 text-2xl font-bold text-[#0f2557]">
        Aucun mouvement financier enregistré.
      </h2>
      <p className="mt-2 text-slate-500">
        {canCreate
          ? "Commencez par enregistrer une entrée ou une sortie."
          : "Aucune entrée ou sortie n’a encore été enregistrée par un administrateur."}
      </p>

      {canCreate && (
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/finances/new?type=INFLOW"
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0f2557] px-5 font-semibold text-white transition hover:bg-[#18366f]"
          >
            <Plus className="h-4 w-4" />
            Nouvelle entrée
          </Link>
          <Link
            href="/finances/new?type=OUTFLOW"
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" />
            Nouvelle sortie
          </Link>
        </div>
      )}
    </div>
  );
}
