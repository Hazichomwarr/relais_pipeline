export default function FunnelAnalyticsEmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
      <p className="font-semibold text-slate-700">
        Aucun prospect pour cette période et ces filtres.
      </p>
      <p className="mt-2 text-sm text-slate-500">
        Ajustez la période ou réinitialisez les filtres pour voir d’autres
        résultats.
      </p>
    </div>
  );
}
