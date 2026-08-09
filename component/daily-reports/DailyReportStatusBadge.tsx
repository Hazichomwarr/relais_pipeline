import type { DailyReportStatus } from "@prisma/client";
import { CheckCircle2, PencilLine, type LucideIcon } from "lucide-react";

const statusPresentation: Record<
  DailyReportStatus,
  { icon: LucideIcon; className: string; label: string }
> = {
  DRAFT: {
    icon: PencilLine,
    className: "bg-amber-100 text-amber-800",
    label: "Brouillon",
  },
  SUBMITTED: {
    icon: CheckCircle2,
    className: "bg-emerald-100 text-emerald-800",
    label: "Envoyé",
  },
};

export default function DailyReportStatusBadge({
  status,
}: {
  status: DailyReportStatus;
}) {
  const { icon: Icon, className, label } = statusPresentation[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${className}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}
