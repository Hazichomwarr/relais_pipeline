import Link from "next/link";

import DailyReportStatusBadge from "@/component/daily-reports/DailyReportStatusBadge";
import { formatDailyReportTime } from "@/src/lib/daily-report-date";
import type { DailyReportRow } from "@/src/services/daily-report.service-core";

/**
 * The compact "Rapport du jour" summary at the top of /reports (Ticket
 * 19B). When there is no report yet for today, the CTA links to the
 * inline create form rendered further down the same page — /reports never
 * creates a database row just because this card is viewed (Ticket 19A's
 * "first Save creates DRAFT" decision).
 */
export default function DailyReportTodayCard({
  report,
}: {
  report: DailyReportRow | null;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
        Rapport du jour
      </p>

      {!report ? (
        <>
          <p className="mt-2 text-lg font-semibold text-slate-800">
            Aucun rapport commencé aujourd’hui.
          </p>
          <a
            href="#rapport-du-jour-formulaire"
            className="mt-4 inline-flex h-12 items-center justify-center rounded-xl bg-[#0f2557] px-6 font-semibold text-white transition hover:bg-[#18366f]"
          >
            Commencer mon rapport
          </a>
        </>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <DailyReportStatusBadge status={report.status} />
            {report.submittedAt && (
              <span className="text-sm text-slate-500">
                Envoyé à {formatDailyReportTime(report.submittedAt)}
              </span>
            )}
          </div>
          <Link
            href={`/reports/${report.id}`}
            className="mt-4 inline-flex h-12 items-center justify-center rounded-xl bg-[#0f2557] px-6 font-semibold text-white transition hover:bg-[#18366f]"
          >
            {report.status === "DRAFT" ? "Continuer mon rapport" : "Voir le rapport"}
          </Link>
        </>
      )}
    </div>
  );
}
