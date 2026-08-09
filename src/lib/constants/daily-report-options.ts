import type { DailyReportTemplateType } from "@prisma/client";

export const dailyReportTemplateTypeOptions = [
  { value: "ASSISTANT", label: "Assistante de Direction" },
  { value: "OPERATIONS_COORDINATOR", label: "Coordinateur des Opérations" },
] as const;

/** Centralized French daily-report-template label, mirroring getUserRoleLabel. */
export function getDailyReportTemplateTypeLabel(
  templateType: DailyReportTemplateType,
): string {
  return (
    dailyReportTemplateTypeOptions.find((option) => option.value === templateType)
      ?.label ?? templateType
  );
}
