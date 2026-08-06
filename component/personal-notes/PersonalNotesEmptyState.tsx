import { StickyNote } from "lucide-react";
import Link from "next/link";

export default function PersonalNotesEmptyState() {
  return (
    <div className="rounded-4xl border border-slate-200 bg-white p-10 text-center">
      <StickyNote className="mx-auto h-10 w-10 text-slate-400" />
      <p className="mt-4 text-lg font-semibold text-slate-800">
        Aucune note pour le moment.
      </p>
      <p className="mx-auto mt-2 max-w-md text-slate-500">
        Créez votre première note pour conserver une idée, un rappel ou une
        tâche personnelle.
      </p>
      <Link
        href="/notes/new"
        className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-[#0f2557] px-6 font-semibold text-white transition hover:bg-[#18366f]"
      >
        Créer une note
      </Link>
    </div>
  );
}
