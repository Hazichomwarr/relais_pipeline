import OperationsProspectingSummary from "@/component/daily-reports/management/OperationsProspectingSummary";
import DailyReportStatusBadge from "@/component/daily-reports/DailyReportStatusBadge";
import { getDailyReportTemplateTypeLabel } from "@/src/lib/constants/daily-report-options";
import { formatDailyReportTime } from "@/src/lib/daily-report-date";
import type { AssistantDailyReportData } from "@/src/lib/validations/assistant-daily-report.schema";
import type { OperationsCoordinatorDailyReportData } from "@/src/lib/validations/operations-coordinator-daily-report.schema";
import type { DailyReportRow } from "@/src/services/daily-report.service-core";

/**
 * The fields this view actually reads — a Pick rather than the full
 * DailyReportRow so it can render both the self-service DailyReportRow
 * (Ticket 19B, submittedAt as Date) and the management DailyReportDetail
 * DTO (Ticket 19C, which has no ownerUserId/createdAt/updatedAt) without
 * either caller fabricating fields it doesn't have.
 */
export type DailyReportReadOnlyViewReport = Pick<
  DailyReportRow,
  "status" | "templateType" | "accomplishedToday" | "plannedTomorrow" | "templateData"
> & { submittedAt: Date | null };

/**
 * Immutable, read-only rendering of a submitted report (Ticket 19B) — no
 * edit controls, no resubmit button. Blank optional fields are simply
 * omitted rather than shown as empty, since Ticket 19B never forces "RAS"
 * into unused fields. Reused as-is for management detail (Ticket 19C).
 */
export default function DailyReportReadOnlyView({
  report,
}: {
  report: DailyReportReadOnlyViewReport;
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
      <OperationsProspectingSummary
        digitalServicesProspects={data.digitalServicesProspects}
        karmdaSchoolProspects={data.karmdaSchoolProspects}
        prospectingException={data.prospectingException}
        prospectingExceptionReason={data.prospectingExceptionReason}
      />

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
