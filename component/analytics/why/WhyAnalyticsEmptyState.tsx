export default function WhyAnalyticsEmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
      <p className="font-semibold text-slate-700">
        Aucune donnée commerciale structurée pour cette période.
      </p>
      <p className="mt-2 text-sm text-slate-500">
        Les analyses apparaîtront ici à mesure que les suivis seront
        enregistrés avec leur résultat et leur raison.
      </p>
    </div>
  );
}
