/**
 * "Explications — Autre": verbatim conversionReasonNote text for OTHER
 * rows, and nothing else — no Prospect.notes, no PersonalNote, no free-text
 * parsing (Ticket 20G's OTHER Privacy / Scope). Renders nothing when there
 * are no OTHER rows in the current scope.
 */
export default function OtherExplanations({
  explanations,
}: {
  explanations: string[];
}) {
  if (explanations.length === 0) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold text-[#0f2557]">Explications — Autre</h2>
      <p className="mt-1 text-sm text-slate-500">
        Précisions saisies lors des suivis classés « Autre ».
      </p>

      <ul className="mt-5 space-y-2">
        {explanations.map((explanation, index) => (
          <li
            key={index}
            className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700"
          >
            {explanation}
          </li>
        ))}
      </ul>
    </section>
  );
}
