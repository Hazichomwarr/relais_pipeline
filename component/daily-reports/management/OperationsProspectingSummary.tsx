import { AlertTriangle, CheckCircle2 } from "lucide-react";

import {
  DIGITAL_SERVICES_PROSPECTING_TARGET,
  isProspectingTargetMet,
  KARMDA_SCHOOL_PROSPECTING_TARGET,
} from "@/src/lib/validations/operations-coordinator-daily-report.schema";

export type OperationsProspectingSummaryProps = {
  digitalServicesProspects: number | null;
  karmdaSchoolProspects: number | null;
  prospectingException: boolean;
  prospectingExceptionReason: string;
};

/**
 * Reused on both a reporter card and the management report detail page
 * (Ticket 19C) — a single place that reads the 3/1 targets and the
 * met/exceeded/exception rule, so neither view hand-duplicates the
 * constants already established in Ticket 19B.
 */
export default function OperationsProspectingSummary({
  digitalServicesProspects,
  karmdaSchoolProspects,
  prospectingException,
  prospectingExceptionReason,
}: OperationsProspectingSummaryProps) {
  const targetMet = isProspectingTargetMet({
    digitalServicesProspects,
    karmdaSchoolProspects,
  });
  const exceeded =
    (digitalServicesProspects ?? 0) > DIGITAL_SERVICES_PROSPECTING_TARGET ||
    (karmdaSchoolProspects ?? 0) > KARMDA_SCHOOL_PROSPECTING_TARGET;

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Prospection</p>

      <div className="mt-2 grid grid-cols-2 gap-3">
        <ProspectingCounter
          label="Services Digitaux"
          count={digitalServicesProspects}
          target={DIGITAL_SERVICES_PROSPECTING_TARGET}
        />
        <ProspectingCounter
          label="Écoles KARMDA"
          count={karmdaSchoolProspects}
          target={KARMDA_SCHOOL_PROSPECTING_TARGET}
        />
      </div>

      {targetMet ? (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {exceeded ? "Objectif dépassé" : "Objectif atteint"}
        </p>
      ) : prospectingException ? (
        <div className="mt-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-700">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Exception justifiée
          </p>
          {prospectingExceptionReason.trim() && (
            <p className="mt-1 text-sm text-slate-600">{prospectingExceptionReason}</p>
          )}
        </div>
      ) : (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-red-700">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          Objectif non atteint
        </p>
      )}
    </div>
  );
}

function ProspectingCounter({
  label,
  count,
  target,
}: {
  label: string;
  count: number | null;
  target: number;
}) {
  const met = count !== null && count >= target;

  return (
    <div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-lg font-bold ${met ? "text-emerald-700" : "text-slate-800"}`}>
        {count ?? "—"} / {target}
      </p>
    </div>
  );
}
