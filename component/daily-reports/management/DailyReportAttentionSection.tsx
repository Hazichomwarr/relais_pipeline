import Link from "next/link";

import { getDailyReportTemplateTypeLabel } from "@/src/lib/constants/daily-report-options";
import type { DailyReportAttentionItem } from "@/src/services/daily-report.service-core";

/**
 * Shared by "Décisions requises" and "Problèmes signalés" (Ticket 19C) —
 * same card shape, different title/content source. Both queues are built
 * from SUBMITTED reports only (see composeDailyReportManagementDashboard),
 * and this component renders the employee's submitted wording verbatim —
 * no summarization, no severity inference.
 */
export default function DailyReportAttentionSection({
  title,
  emptyMessage,
  items,
}: {
  title: string;
  emptyMessage: string;
  items: DailyReportAttentionItem[];
}) {
  return (
    <section>
      <h2 className="mb-4 text-xl font-bold text-[#0f2557]">{title}</h2>

      {items.length === 0 ? (
        <p className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-500">
          {emptyMessage}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.reportId} className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="font-semibold text-slate-800">
                {item.owner.firstName} {item.owner.lastName}
              </p>
              <p className="text-sm text-slate-500">
                {getDailyReportTemplateTypeLabel(item.templateType)}
              </p>
              <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-slate-700">
                {item.content}
              </p>
              <Link
                href={`/admin/reports/${item.reportId}`}
                className="mt-3 inline-flex text-sm font-semibold text-blue-600 hover:underline"
              >
                Voir le rapport
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
