import { CheckCircle2, CircleDashed, PencilLine, type LucideIcon } from "lucide-react";

import type { DailyReporterState } from "@/src/services/daily-report.service-core";

/**
 * NOT_STARTED is a derived UI-only state (Ticket 19C) — never a
 * DailyReportStatus value, never persisted. This badge is intentionally
 * separate from DailyReportStatusBadge (Ticket 19B), which only ever
 * renders a real, persisted DRAFT/SUBMITTED status.
 */
const statePresentation: Record<
  DailyReporterState,
  { icon: LucideIcon; className: string; label: string }
> = {
  SUBMITTED: {
    icon: CheckCircle2,
    className: "bg-emerald-100 text-emerald-800",
    label: "Envoyé",
  },
  DRAFT: {
    icon: PencilLine,
    className: "bg-amber-100 text-amber-800",
    label: "Brouillon",
  },
  NOT_STARTED: {
    icon: CircleDashed,
    className: "bg-slate-100 text-slate-600",
    label: "Non commencé",
  },
};

export default function DailyReporterStateBadge({
  state,
}: {
  state: DailyReporterState;
}) {
  const { icon: Icon, className, label } = statePresentation[state];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${className}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}
