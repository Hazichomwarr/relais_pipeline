import { ClipboardList } from "lucide-react";

export default function DailyReportEmptyState() {
  return (
    <div className="rounded-4xl border border-slate-200 bg-white p-10 text-center">
      <ClipboardList className="mx-auto h-10 w-10 text-slate-400" />
      <p className="mt-4 text-lg font-semibold text-slate-800">
        Aucun rapport pour le moment.
      </p>
      <p className="mx-auto mt-2 max-w-md text-slate-500">
        Commencez votre rapport du jour ci-dessus.
      </p>
    </div>
  );
}
