import { Newspaper } from "lucide-react";

export default function SharedFeedEmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
      <Newspaper
        aria-hidden="true"
        className="mx-auto h-8 w-8 text-slate-300"
      />
      <p className="mt-4 font-semibold text-slate-700">
        Aucune activité récente.
      </p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
        Les interactions, suivis terminés, nouveaux clients et changements
        d’équipe apparaîtront ici.
      </p>
    </div>
  );
}
