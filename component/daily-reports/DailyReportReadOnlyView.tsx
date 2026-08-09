import DailyReportStatusBadge from "@/component/daily-reports/DailyReportStatusBadge";
import { getDailyReportTemplateTypeLabel } from "@/src/lib/constants/daily-report-options";
import { formatDailyReportTime } from "@/src/lib/daily-report-date";
import type { AssistantDailyReportData } from "@/src/lib/validations/assistant-daily-report.schema";
import {
  DIGITAL_SERVICES_PROSPECTING_TARGET,
  KARMDA_SCHOOL_PROSPECTING_TARGET,
  type OperationsCoordinatorDailyReportData,
} from "@/src/lib/validations/operations-coordinator-daily-report.schema";
import type { DailyReportRow } from "@/src/services/daily-report.service-core";

/**
 * Immutable, read-only rendering of a submitted report (Ticket 19B) — no
 * edit controls, no resubmit button. Blank optional fields are simply
 * omitted rather than shown as empty, since Ticket 19B never forces "RAS"
 * into unused fields.
 */
export default function DailyReportReadOnlyView({
  report,
}: {
  report: DailyReportRow;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <DailyReportStatusBadge status={report.status} />
        {report.submittedAt && (
          <span className="text-sm text-slate-500">
            Envoyé à {formatDailyReportTime(report.submittedAt)}
          </span>
        )}
        <span className="text-sm text-slate-400">
          {getDailyReportTemplateTypeLabel(report.templateType)}
        </span>
      </div>

      <ReadOnlyField label="Réalisé aujourd’hui" value={report.accomplishedToday} />

      {report.templateType === "ASSISTANT" ? (
        <AssistantReadOnlyFields
          data={report.templateData as AssistantDailyReportData}
        />
      ) : (
        <OperationsCoordinatorReadOnlyFields
          data={report.templateData as OperationsCoordinatorDailyReportData}
        />
      )}

      <ReadOnlyField label="Prévu demain" value={report.plannedTomorrow} />
    </div>
  );
}

function AssistantReadOnlyFields({ data }: { data: AssistantDailyReportData }) {
  return (
    <>
      <ReadOnlyField
        label="Documents préparés ou classés"
        value={data.documentsPrepared}
      />
      <ReadOnlyField label="Clients / prospects suivis" value={data.clientsFollowed} />
      <ReadOnlyField
        label="Paiements ou signatures en attente"
        value={data.pendingPaymentsOrSignatures}
      />
      <ReadOnlyField label="Problèmes rencontrés" value={data.problemsEncountered} />
      <ReadOnlyField
        label="Besoin de décision de la Direction"
        value={data.managementDecisionNeeded}
      />
    </>
  );
}

function OperationsCoordinatorReadOnlyFields({
  data,
}: {
  data: OperationsCoordinatorDailyReportData;
}) {
  return (
    <>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
          Prospection
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <p className="text-slate-700">
            Services Digitaux : {data.digitalServicesProspects ?? 0} /{" "}
            {DIGITAL_SERVICES_PROSPECTING_TARGET}
          </p>
          <p className="text-slate-700">
            Écoles KARMDA : {data.karmdaSchoolProspects ?? 0} /{" "}
            {KARMDA_SCHOOL_PROSPECTING_TARGET}
          </p>
        </div>
      </div>

      {data.prospectingException && (
        <ReadOnlyField
          label="Exception : installation / formation"
          value={data.prospectingExceptionReason}
        />
      )}

      <ReadOnlyField label="En attente" value={data.pendingItems} />
      <ReadOnlyField label="Problèmes rencontrés" value={data.problemsEncountered} />
      <ReadOnlyField
        label="Besoin de décision de la Direction"
        value={data.managementDecisionNeeded}
      />
    </>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  if (!value.trim()) {
    return null;
  }

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-slate-700">{value}</p>
    </div>
  );
}
