/**
 * "revenue" tone colors a positive change green and a negative change
 * red (more inflow / more net movement reads as good). "expense" tone
 * never colors the change either way — a bigger or smaller outflow
 * isn't inherently good or bad, so no celebratory green for a positive
 * percentage change in spending (Ticket 17C).
 */
export default function FinancialComparisonIndicator({
  changePercent,
  tone,
}: {
  changePercent: string | null;
  tone: "revenue" | "expense";
}) {
  if (changePercent === null) {
    return <p className="mt-1 text-xs text-slate-400">Pas de comparaison disponible</p>;
  }

  const isNegative = changePercent.startsWith("-");
  const sign = isNegative ? "" : "+";
  const colorClassName =
    tone === "revenue"
      ? isNegative
        ? "text-red-600"
        : "text-emerald-600"
      : "text-slate-500";

  return (
    <p className={`mt-1 text-xs font-semibold ${colorClassName}`}>
      {sign}
      {changePercent} % vs période précédente
    </p>
  );
}
