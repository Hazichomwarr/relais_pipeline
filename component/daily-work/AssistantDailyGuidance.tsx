import { HandHelping } from "lucide-react";

/**
 * Ticket 27A §7/§28, 27F §28 — Assistant is intentionally not a DailyTask
 * recipient; this replaces the task checklist with static role guidance.
 * Deliberately not styled as an empty/error state — Assistant's day is
 * fully valid, just structurally different (27E never creates a
 * DailyTask for this role, so there is nothing to persist here).
 */
export default function AssistantDailyGuidance() {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-[#0f2557]">Votre rôle aujourd’hui</h2>
      <div className="flex items-start gap-4 rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#0f2557]">
          <HandHelping className="h-5 w-5" aria-hidden="true" />
        </div>
        <p className="pt-2 leading-6 text-slate-700">
          Appuie le Coordinateur selon les besoins de la journée et reste
          disponible pour les demandes de la Direction.
        </p>
      </div>
    </section>
  );
}
